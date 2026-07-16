import prisma from "../config/prisma.js";
import { startProductionFromOrder } from "./productionService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildMonthRange, recentDaysWhere } from "../utils/dateFilters.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { ORDER_LIST_SELECT } from "../utils/selects.js";
import { getPrimaryEnquiryProduct } from "../utils/enquiryProducts.js";
import { ensureProductsExist } from "../utils/productCatalog.js";
import { getCustomerMasterProfileByName } from "../utils/customerCatalog.js";
import { normalizeCurrencyInput, normalizePriceInput } from "../utils/commerce.js";
import { normalizeOrderUnit } from "../utils/orderUnits.js";
import {
  extractSalesGroupSequence,
  formatSalesGroupNumber,
  formatSalesOrderNumber,
  normalizeSalesGroupNumber
} from "../utils/businessNumbers.js";

const ORDER_CACHE_PREFIX = "orders:list";
const ORDER_CACHE_TTL_MS = 12 * 1000;

function generateOrderNo(id) {
  return `ORD-${String(id).padStart(4, "0")}`;
}

function isNonEmpty(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function isDispatchLifecycleStatus(status) {
  return ["READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "COMPLETED", "DISPATCHED"].includes(status);
}

function invalidateOrderReadCaches() {
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("production:");
  invalidateCacheByPrefix("dashboard:");
}

// Same rule as the copy in dispatchService: resolve the highest sequence in the
// database rather than pulling every Order row back, and lock it so two orders
// created at once cannot both read the same max and be handed the same group
// number (salesGroupNumber has no unique constraint to catch that).
async function getNextSalesGroupNumber() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT `salesGroupNumber` FROM `Order` " +
    "WHERE `salesGroupNumber` REGEXP '^SO[_-][0-9]+$' " +
    "ORDER BY CAST(SUBSTRING(`salesGroupNumber`, 4) AS UNSIGNED) DESC LIMIT 1 FOR UPDATE"
  );

  const maxSequence = extractSalesGroupSequence(rows?.[0]?.salesGroupNumber);
  return formatSalesGroupNumber(maxSequence + 1);
}

export function buildOrderCreateData({
  payload,
  enquiry,
  createdByUser,
  customerProfile,
  salesGroupNumber,
  product
}) {
  const resolvedAddress = customerProfile?.address || payload.address || null;
  const resolvedCity = customerProfile?.city || payload.city || null;
  const resolvedPincode = customerProfile?.pincode || payload.pincode || null;
  const resolvedState = customerProfile?.state || payload.state || null;
  const resolvedCountryCode = customerProfile?.countryCode || payload.country_code || null;
  const resolvedPrice = payload.price !== undefined
    ? normalizePriceInput(payload.price)
    : enquiry?.price ?? null;
  const resolvedCurrency = payload.currency !== undefined
    ? normalizeCurrencyInput(payload.currency)
    : enquiry?.currency ?? null;

  return {
    enquiryId: enquiry?.id ?? null,
    createdById: createdByUser.id,
    salesGroupNumber,
    salesOrderNumber: `TSO-${Date.now()}`,
    orderNo: `TMP-${Date.now()}`,
    product,
    grade: payload.grade,
    quantity: payload.quantity,
    price: resolvedPrice,
    currency: resolvedCurrency,
    unit: normalizeOrderUnit(payload.unit),
    packingType: payload.packing_type,
    packingSize: payload.packing_size,
    deliveryDate: new Date(payload.delivery_date),
    clientName: payload.client_name,
    address: resolvedAddress,
    city: resolvedCity,
    pincode: resolvedPincode,
    state: resolvedState,
    countryCode: resolvedCountryCode,
    remarks: payload.remarks,
    status: "CREATED"
  };
}

export function buildOrderUpdateData(payload, customerProfile = null) {
  return {
    product: payload.product !== undefined ? payload.product : undefined,
    grade: payload.grade,
    quantity: payload.quantity,
    price: payload.price !== undefined ? normalizePriceInput(payload.price) : undefined,
    currency: payload.currency !== undefined ? normalizeCurrencyInput(payload.currency) : undefined,
    unit: payload.unit !== undefined ? normalizeOrderUnit(payload.unit) : undefined,
    packingType: payload.packing_type,
    packingSize: payload.packing_size,
    deliveryDate: payload.delivery_date ? new Date(payload.delivery_date) : undefined,
    clientName: payload.client_name,
    address: customerProfile?.address || payload.address,
    city: customerProfile?.city || payload.city,
    pincode: customerProfile?.pincode || payload.pincode,
    state: customerProfile?.state || payload.state,
    countryCode: customerProfile?.countryCode || payload.country_code,
    remarks: payload.remarks
  };
}

export async function createOrder(payload, createdByUser) {
  const enquiryId = payload.enquiry_id ? Number(payload.enquiry_id) : null;
  let enquiry = null;

  if (enquiryId) {
    enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: {
        id: true,
        status: true,
        companyName: true,
        enquiryNumber: true,
        product: true,
        products: true,
        quantity: true,
        price: true,
        currency: true,
        order: {
          select: {
            id: true
          }
        }
      }
    });

    if (!enquiry) {
      const error = new Error("Enquiry not found.");
      error.statusCode = 404;
      throw error;
    }

    if (enquiry.status !== "ACCEPTED") {
      const error = new Error("Cannot create order unless enquiry status is ACCEPTED.");
      error.statusCode = 400;
      throw error;
    }

    if (enquiry.order) {
      const error = new Error("Order already exists for this enquiry.");
      error.statusCode = 409;
      throw error;
    }
  }

  const customerProfile = await getCustomerMasterProfileByName(payload.client_name);

  let finalOrder;

  if (enquiryId) {
    const existingGroup = await prisma.order.findFirst({
      where: {
        enquiry: {
          enquiryNumber: enquiry.enquiryNumber
        }
      },
      select: {
        salesGroupNumber: true
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    const salesGroupNumber = normalizeSalesGroupNumber(existingGroup?.salesGroupNumber) || await getNextSalesGroupNumber();
    const product = isNonEmpty(payload.product)
      ? (await ensureProductsExist(payload.product))[0]
      : getPrimaryEnquiryProduct(enquiry);

    const order = await prisma.order.create({
      data: buildOrderCreateData({
        payload,
        enquiry,
        createdByUser,
        customerProfile,
        salesGroupNumber,
        product
      })
    });

    finalOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        salesOrderNumber: formatSalesOrderNumber(order.id),
        orderNo: generateOrderNo(order.id)
      },
      select: ORDER_LIST_SELECT
    });
  } else {
    const error = new Error("Manual orders must be created through manual order requests.");
    error.statusCode = 400;
    throw error;
  }

  invalidateOrderReadCaches();
  return finalOrder;
}

export async function listOrders(filters = {}) {
  const { status, payment_status: paymentStatus, q, client, date, month, recent_days: recentDays } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const normalizedClient = String(client || "").trim();
  const normalizedDate = String(date || "").trim();
  const dateFrom = normalizedDate ? new Date(`${normalizedDate}T00:00:00.000Z`) : null;
  const dateTo = normalizedDate ? new Date(`${normalizedDate}T23:59:59.999Z`) : null;

  // `status` accepts one value (equals) or a comma-separated list (IN) — the
  // Payments worklist needs the three dispatched states at once, and a single
  // caller passing one status still works unchanged.
  const statusList = String(status || "").split(",").map((s) => s.trim()).filter(Boolean);
  const statusWhere = statusList.length > 1
    ? { status: { in: statusList } }
    : statusList.length === 1
      ? { status: statusList[0] }
      : {};
  const normalizedPaymentStatus = String(paymentStatus || "").trim();

  const where = {
    ...statusWhere,
    ...(normalizedPaymentStatus ? { paymentStatus: normalizedPaymentStatus } : {}),
    // Mobile sends recent_days=45; desktop omits it and sees full history.
    ...recentDaysWhere("createdAt", recentDays),
    ...(normalizedClient ? { clientName: { contains: normalizedClient } } : {}),
    ...(normalizedDate && dateFrom && dateTo ? { deliveryDate: { gte: dateFrom, lte: dateTo } } : {}),
    // Month = when the order was placed. AND-wrapped so it can't clobber the
    // search box's OR below.
    ...(buildMonthRange(month) ? { AND: [{ orderDate: buildMonthRange(month) }] } : {}),
    ...(q
      ? {
          OR: [
            { salesOrderNumber: { contains: q } },
            { salesGroupNumber: { contains: q } },
            { orderNo: { contains: q } },
            { clientName: { contains: q } },
            { product: { contains: q } },
            { grade: { contains: q } },
            { enquiry: { enquiryNumber: { contains: q } } },
            { enquiry: { companyName: { contains: q } } }
          ]
        }
      : {})
  };

  const query = {
    where,
    select: ORDER_LIST_SELECT,
    // Finished orders sink to the bottom, newest-first within each group. This
    // has to happen in the query, not on the client: the list is paginated
    // server-side, so a completed order would otherwise still occupy page 1.
    //
    // MySQL sorts an ENUM by its declared position, and OrderStatus is declared
    // CREATED, IN_PRODUCTION, READY_FOR_DISPATCH, PARTIALLY_DISPATCHED,
    // COMPLETED, DISPATCHED — so ascending puts the two finished states last.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }, { id: "desc" }]
  };

  const cacheKey = buildCacheKey(ORDER_CACHE_PREFIX, {
    status: status || null,
    paymentStatus: normalizedPaymentStatus || null,
    month: String(month || "") || null,
    recentDays: String(recentDays || "") || null,
    q: q || null,
    client: normalizedClient || null,
    date: normalizedDate || null,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, ORDER_CACHE_TTL_MS, async () => {
    if (take > 0) {
      const [items, total] = await Promise.all([
        prisma.order.findMany({
          ...query,
          skip,
          take
        }),
        prisma.order.count({ where })
      ]);

      return {
        items,
        pagination: {
          page,
          limit: take,
          total,
          totalPages: Math.max(1, Math.ceil(total / take))
        }
      };
    }

    return prisma.order.findMany(query);
  });
}

export async function moveOrderToProduction(orderId, actorUser, client = prisma) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      clientName: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      quantity: true,
      product: true,
      grade: true,
      packingType: true,
      deliveryDate: true,
      salesOrderNumber: true
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (isDispatchLifecycleStatus(order.status)) {
    const error = new Error("Only active orders can move to production.");
    error.statusCode = 400;
    throw error;
  }

  const missing = [];
  if (!isNonEmpty(order.city)) missing.push("City");
  if (!isNonEmpty(order.pincode)) missing.push("Pincode");
  if (!isNonEmpty(order.state)) missing.push("State");
  if (!isNonEmpty(order.countryCode)) missing.push("Country");

  if (missing.length > 0) {
    const error = new Error(`Fill required location fields before production: ${missing.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  const { order: updatedOrder } = await startProductionFromOrder(order, actorUser, {}, client);

  invalidateOrderReadCaches();
  return updatedOrder;
}

export async function updateOrder(orderId, payload, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      price: true,
      currency: true,
      productions: {
        select: {
          id: true
        }
      },
      dispatches: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if ((order.productions && order.productions.length > 0) || (order.dispatches && order.dispatches.length > 0)) {
    const error = new Error("Cannot edit order after production/dispatch starts.");
    error.statusCode = 400;
    throw error;
  }

  const customerProfile = payload.client_name
    ? await getCustomerMasterProfileByName(payload.client_name)
    : null;

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      ...buildOrderUpdateData(payload, customerProfile),
      product: payload.product !== undefined ? (await ensureProductsExist(payload.product))[0] : undefined
    },
    select: ORDER_LIST_SELECT
  });

  invalidateOrderReadCaches();
  return updatedOrder;
}

// The accounts step at the end of the approved flow. Only accounts (and admin)
// may record payment — the same business rule that governs PO pricing, kept in
// code rather than in the module matrix, because module access decides whether
// you can open the screen, not whether you can settle an order.
//
// Recording payment in full is what finally completes a shipped order: dispatch
// leaves it DISPATCHED, and only the money moves it to COMPLETED.
export async function updateOrderPayment(orderId, payload, actorUser) {
  if (!["admin", "accounts"].includes(actorUser?.role)) {
    const error = new Error("Only the accounts department can record payment.");
    error.statusCode = 403;
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      quantity: true,
      status: true,
      dispatches: { select: { dispatchedQuantity: true } }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const paymentStatus = payload.payment_status;
  const delivered = order.dispatches.reduce(
    (total, dispatch) => total + Number(dispatch.dispatchedQuantity || 0),
    0
  );
  const fullyDispatched = delivered >= Number(order.quantity);

  // Payment is only meaningful once something has actually shipped — otherwise
  // an order could be marked paid and completed before it was ever made.
  if (paymentStatus !== "PENDING" && delivered <= 0) {
    const error = new Error("Payment can only be recorded once the order has been dispatched.");
    error.statusCode = 400;
    throw error;
  }

  const data = {
    paymentStatus,
    amountReceived: payload.amount_received === undefined || payload.amount_received === null
      ? null
      : Number(payload.amount_received),
    paymentRemarks: payload.remarks?.trim() || null,
    paymentReceivedAt: paymentStatus === "RECEIVED" ? new Date() : null
  };

  // Completing the order is the whole point of this step; a payment reversal
  // (RECEIVED → PARTIAL/PENDING) has to walk it back out of COMPLETED too.
  if (paymentStatus === "RECEIVED" && fullyDispatched) {
    data.status = "COMPLETED";
  } else if (order.status === "COMPLETED" && paymentStatus !== "RECEIVED") {
    data.status = fullyDispatched ? "DISPATCHED" : "PARTIALLY_DISPATCHED";
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data
  });

  invalidateOrderReadCaches();
  return updated;
}

export async function deleteOrder(orderId, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      productions: {
        select: {
          id: true
        }
      },
      dispatches: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if ((order.productions && order.productions.length > 0) || (order.dispatches && order.dispatches.length > 0)) {
    const error = new Error("Cannot delete order with production/dispatch records.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {

    await tx.order.delete({
      where: { id: orderId }
    });

    return { id: orderId };
  });

  invalidateOrderReadCaches();
  return result;
}
