import prisma from "../config/prisma.js";
import { orderOwnerWhere } from "../utils/dataScope.js";
import { invalidateCacheByPrefix } from "../utils/responseCache.js";

// Money is stored as floats, so "fully paid" has to tolerate a paisa of drift.
const EPSILON = 0.005;

export const AGING_BUCKETS = [
  { key: "d0_30", label: "0-30 days", max: 30 },
  { key: "d31_60", label: "31-60 days", max: 60 },
  { key: "d61_90", label: "61-90 days", max: 90 },
  { key: "d90_plus", label: "90+ days", max: Infinity }
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Go-live for payment tracking: invoices dated before this are out of the aging
// report, so the outstanding totals only cover invoices raised on the system.
export const AGING_START_DATE = (process.env.AGING_START_DATE || "2026-10-01").trim();

function round2(value) {
  return Math.round(value * 100) / 100;
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertAccounts(actorUser) {
  if (!["admin", "accounts"].includes(actorUser?.role)) {
    throw httpError("Only the accounts department can record payment.", 403);
  }
}

function invalidatePaymentReadCaches() {
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("dashboard:");
}

// An invoice is one dispatch, billed at the order's unit price. With no price on
// the order the value is unknown (null) and the invoice can only be settled by
// a FULL receipt.
export function invoiceAmount(dispatch, order) {
  if (order.price === null || order.price === undefined) return null;
  return round2(Number(dispatch.dispatchedQuantity || 0) * Number(order.price));
}

// Received / pending / settled for one invoice, from its payment rows. A priced
// invoice is settled by the money alone: a FULL receipt only covered what was
// owed when it was booked, so if the invoice grows later the rest is pending.
export function summariseInvoice(dispatch, order) {
  const amount = invoiceAmount(dispatch, order);
  const payments = dispatch.payments || [];
  const received = round2(payments.reduce((sum, p) => sum + Number(p.amount || 0), 0));
  const hasFull = payments.some((p) => p.paymentType === "FULL");
  const settled = amount === null ? hasFull : received >= amount - EPSILON;
  const pending = amount === null ? null : settled ? 0 : round2(amount - received);
  return { amount, received, pending, settled };
}

function parseReceivedDate(value) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw httpError("Received date is invalid.", 400);
  if (parsed.getTime() > Date.now() + DAY_MS) throw httpError("Received date cannot be in the future.", 400);
  return parsed;
}

// Rolls an order's payment rows up into Order.paymentStatus / amountReceived /
// paymentReceivedAt. Settled means every invoice raised so far is settled, so
// dispatching more goods later correctly drops a paid order back to PARTIAL.
// Returns the new paymentStatus; callers decide what that means for the order's
// lifecycle status.
export async function recomputeOrderPayment(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      price: true,
      dispatches: {
        select: {
          id: true,
          dispatchedQuantity: true,
          payments: { select: { amount: true, paymentType: true, receivedAt: true } }
        }
      }
    }
  });
  if (!order) return null;

  const invoices = order.dispatches.map((dispatch) => ({
    dispatch,
    ...summariseInvoice(dispatch, order)
  }));
  const allPayments = order.dispatches.flatMap((dispatch) => dispatch.payments);
  const totalReceived = round2(allPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0));

  let paymentStatus = "PENDING";
  if (invoices.length > 0 && invoices.every((invoice) => invoice.settled)) paymentStatus = "RECEIVED";
  else if (allPayments.length > 0) paymentStatus = "PARTIAL";

  const lastReceivedAt = allPayments.reduce(
    (latest, p) => (!latest || p.receivedAt > latest ? p.receivedAt : latest),
    null
  );

  await tx.order.update({
    where: { id: orderId },
    data: {
      paymentStatus,
      amountReceived: allPayments.length > 0 ? totalReceived : null,
      paymentReceivedAt: paymentStatus === "RECEIVED" ? lastReceivedAt : null
    }
  });

  return paymentStatus;
}

// Completing the order is the whole point of the accounts step: dispatch leaves
// it DISPATCHED, and only the money moves it to COMPLETED. A reversal walks it
// back out again.
async function syncOrderStatusAfterPayment(tx, orderId, paymentStatus) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { quantity: true, status: true, dispatches: { select: { dispatchedQuantity: true } } }
  });
  const delivered = order.dispatches.reduce((sum, d) => sum + Number(d.dispatchedQuantity || 0), 0);
  const fullyDispatched = delivered >= Number(order.quantity);

  let status = null;
  if (paymentStatus === "RECEIVED" && fullyDispatched) status = "COMPLETED";
  else if (order.status === "COMPLETED") status = fullyDispatched ? "DISPATCHED" : "PARTIALLY_DISPATCHED";

  if (status && status !== order.status) {
    await tx.order.update({ where: { id: orderId }, data: { status } });
  }
}

// Row lock on the order, always taken before any Dispatch lock so concurrent
// receipts, deletions and dispatch changes can't deadlock on opposite orders.
export async function lockOrderForPayment(tx, orderId) {
  await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${orderId} FOR UPDATE`;
}

// Books a receipt against one invoice of an order. `invoice_number` is only
// used to fill in a missing number on that dispatch — accounts often learns it
// after the goods have shipped.
export async function recordPayment(orderId, payload, actorUser) {
  assertAccounts(actorUser);

  const payment = await prisma.$transaction(async (tx) => {
    // Serialise receipts on this invoice: without the row lock two concurrent
    // requests both read the same pending balance and both pass the check.
    await lockOrderForPayment(tx, orderId);
    await tx.$queryRaw`SELECT id FROM \`Dispatch\` WHERE id = ${payload.dispatch_id} FOR UPDATE`;

    const dispatch = await tx.dispatch.findUnique({
      where: { id: payload.dispatch_id },
      select: {
        id: true,
        orderId: true,
        dispatchedQuantity: true,
        invoiceNumber: true,
        payments: { select: { amount: true, paymentType: true } },
        order: { select: { price: true } }
      }
    });
    if (!dispatch || dispatch.orderId !== orderId) {
      throw httpError("That invoice does not belong to this order.", 404);
    }

    const { amount: invoiceTotal, pending, settled } = summariseInvoice(dispatch, dispatch.order);
    if (settled) throw httpError("This invoice is already fully paid.", 409);

    const isFull = payload.payment_type === "FULL";
    let amount = payload.amount;
    if (amount === undefined || amount === null) {
      if (!isFull || pending === null) throw httpError("Enter the amount received.", 400);
      amount = pending; // a full receipt with no amount means "the rest"
    }
    if (!(amount > 0)) throw httpError("Amount received must be greater than zero.", 400);

    if (invoiceTotal !== null) {
      if (amount > pending + EPSILON) {
        throw httpError(`Amount exceeds the pending balance for this invoice (${pending}).`, 400);
      }
      if (isFull && amount < pending - EPSILON) {
        throw httpError(`A full payment must cover the pending balance (${pending}); record it as partial instead.`, 400);
      }
    }

    const invoiceNumber = payload.invoice_number?.trim();
    if (invoiceNumber && invoiceNumber !== dispatch.invoiceNumber) {
      if (dispatch.invoiceNumber) {
        throw httpError("This invoice already has a number; change it from the dispatch screen.", 400);
      }
      await tx.dispatch.update({ where: { id: dispatch.id }, data: { invoiceNumber } });
    }

    const created = await tx.payment.create({
      data: {
        orderId,
        dispatchId: dispatch.id,
        amount,
        paymentType: payload.payment_type,
        receivedAt: parseReceivedDate(payload.received_date),
        remarks: payload.remarks?.trim() || null,
        createdById: actorUser.id
      }
    });

    const paymentStatus = await recomputeOrderPayment(tx, orderId);
    await syncOrderStatusAfterPayment(tx, orderId, paymentStatus);
    return created;
  });

  invalidatePaymentReadCaches();
  return payment;
}

export async function deletePayment(orderId, paymentId, actorUser) {
  assertAccounts(actorUser);

  await prisma.$transaction(async (tx) => {
    await lockOrderForPayment(tx, orderId);

    const payment = await tx.payment.findUnique({ where: { id: paymentId }, select: { id: true, orderId: true } });
    if (!payment || payment.orderId !== orderId) throw httpError("Payment not found.", 404);

    await tx.payment.delete({ where: { id: paymentId } });
    const paymentStatus = await recomputeOrderPayment(tx, orderId);
    await syncOrderStatusAfterPayment(tx, orderId, paymentStatus);
  });

  invalidatePaymentReadCaches();
  return { id: paymentId };
}

// Invoices (dispatches) with their receipts, for the payment dialog.
export async function listOrderInvoices(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      price: true,
      currency: true,
      dispatches: {
        select: {
          id: true,
          invoiceNumber: true,
          dispatchedQuantity: true,
          dispatchDate: true,
          payments: {
            select: { id: true, amount: true, paymentType: true, receivedAt: true, remarks: true },
            orderBy: [{ receivedAt: "asc" }, { id: "asc" }]
          }
        },
        orderBy: [{ dispatchDate: "asc" }, { id: "asc" }]
      }
    }
  });
  if (!order) throw httpError("Order not found.", 404);

  return order.dispatches.map((dispatch) => ({
    id: dispatch.id,
    invoiceNumber: dispatch.invoiceNumber,
    dispatchDate: dispatch.dispatchDate,
    quantity: dispatch.dispatchedQuantity,
    currency: order.currency,
    payments: dispatch.payments,
    ...summariseInvoice(dispatch, order)
  }));
}

function bucketFor(ageDays) {
  return AGING_BUCKETS.find((bucket) => ageDays <= bucket.max).key;
}

function parseAsOn(value) {
  if (!value) return new Date();
  const parsed = new Date(`${value}T23:59:59.999Z`);
  if (Number.isNaN(parsed.getTime())) throw httpError("as_on must be YYYY-MM-DD.", 400);
  return parsed;
}

// Invoices raised before go-live are legacy and are not counted. The caller can
// move the cut-off, or pass an explicit blank `from` to drop it altogether.
function parseFrom(query) {
  if (!Object.prototype.hasOwnProperty.call(query, "from")) return new Date(`${AGING_START_DATE}T00:00:00.000Z`);
  const value = String(query.from || "").trim();
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw httpError("from must be YYYY-MM-DD.", 400);
  return parsed;
}

// Invoice-wise received vs pending, aged from the invoice (dispatch) date.
// Only invoices from AGING_START_DATE onwards are counted. Settled invoices are
// left out unless include_settled is set. Totals are kept per currency — summing
// rupees and dollars into one number would be wrong.
export async function getAgingReport(query = {}, { ownerId = null } = {}) {
  const asOn = parseAsOn(String(query.as_on || "").trim());
  const from = parseFrom(query);
  const client = String(query.client || "").trim();
  const q = String(query.q || "").trim();
  const includeSettled = String(query.include_settled || "") === "1";

  const dispatches = await prisma.dispatch.findMany({
    where: {
      dispatchDate: from ? { gte: from, lte: asOn } : { lte: asOn },
      order: {
        ...(client ? { clientName: { contains: client } } : {}),
        ...(ownerId ? orderOwnerWhere(ownerId) : {})
      },
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q } },
              { order: { orderNo: { contains: q } } },
              { order: { salesOrderNumber: { contains: q } } },
              { order: { clientName: { contains: q } } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      orderId: true,
      invoiceNumber: true,
      dispatchedQuantity: true,
      dispatchDate: true,
      payments: { select: { amount: true, paymentType: true, receivedAt: true } },
      order: { select: { orderNo: true, clientName: true, product: true, price: true, currency: true } }
    },
    orderBy: [{ dispatchDate: "asc" }, { id: "asc" }]
  });

  const rows = [];
  const totals = new Map();

  for (const dispatch of dispatches) {
    // A receipt booked after the as-on date didn't exist yet on that date.
    const visible = { ...dispatch, payments: dispatch.payments.filter((p) => p.receivedAt <= asOn) };
    const { amount, received, pending, settled } = summariseInvoice(visible, dispatch.order);
    if (settled && !includeSettled) continue;

    const ageDays = Math.max(0, Math.floor((asOn.getTime() - dispatch.dispatchDate.getTime()) / DAY_MS));
    const bucket = settled ? null : bucketFor(ageDays);

    rows.push({
      dispatchId: dispatch.id,
      orderId: dispatch.orderId,
      invoiceNumber: dispatch.invoiceNumber,
      orderNo: dispatch.order.orderNo,
      clientName: dispatch.order.clientName,
      product: dispatch.order.product,
      currency: dispatch.order.currency,
      invoiceDate: dispatch.dispatchDate,
      invoiceAmount: amount,
      received,
      pending,
      settled,
      ageDays,
      bucket
    });

    const currency = dispatch.order.currency || "-";
    if (!totals.has(currency)) {
      totals.set(currency, {
        currency,
        invoiced: 0,
        received: 0,
        pending: 0,
        unpriced: 0,
        buckets: Object.fromEntries(AGING_BUCKETS.map((b) => [b.key, 0]))
      });
    }
    const total = totals.get(currency);
    if (amount === null) {
      if (!settled) total.unpriced += 1;
      total.received = round2(total.received + received);
    } else {
      total.invoiced = round2(total.invoiced + amount);
      total.received = round2(total.received + received);
      total.pending = round2(total.pending + (pending || 0));
      if (bucket) total.buckets[bucket] = round2(total.buckets[bucket] + (pending || 0));
    }
  }

  return {
    asOn: asOn.toISOString().slice(0, 10),
    from: from ? from.toISOString().slice(0, 10) : null,
    buckets: AGING_BUCKETS.map(({ key, label }) => ({ key, label })),
    summary: [...totals.values()],
    rows
  };
}
