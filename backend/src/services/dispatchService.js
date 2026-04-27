import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { DISPATCH_LIST_SELECT, MANUAL_ORDER_REQUEST_SELECT } from "../utils/selects.js";
import { formatEnquiryProducts, getPrimaryEnquiryProduct } from "../utils/enquiryProducts.js";
import {
  extractSalesGroupSequence,
  formatSalesGroupNumber,
  formatSalesOrderNumber,
  normalizeSalesGroupNumber
} from "../utils/businessNumbers.js";

let hasDispatchDateColumnCache;
const DISPATCH_CACHE_PREFIX = "dispatch:dashboard";
const DISPATCH_CACHE_TTL_MS = 12 * 1000;

function getDeliveredQuantity(dispatches = []) {
  return dispatches.reduce((sum, item) => sum + (item.dispatchedQuantity || 0), 0);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function generateOrderNo(id) {
  return `ORD-${String(id).padStart(6, "0")}`;
}

function invalidateDispatchReadCaches() {
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("production:");
  invalidateCacheByPrefix("enquiries:");
  invalidateCacheByPrefix("dashboard:");
}

function normalizeDateKey(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function validateDeliveredShipmentStatus(shipmentStatus, dispatchQuantity, remainingQuantity) {
  if (String(shipmentStatus || "").toUpperCase() !== "DELIVERED") return;
  if (dispatchQuantity < remainingQuantity) {
    const error = new Error(`DELIVERED is only allowed when dispatch quantity equals remaining quantity (${remainingQuantity}).`);
    error.statusCode = 400;
    throw error;
  }
}

async function getNextSalesGroupNumber(client = prisma) {
  const existing = await client.order.findMany({
    select: {
      salesGroupNumber: true
    }
  });
  const maxSequence = existing.reduce((max, row) => Math.max(max, extractSalesGroupSequence(row.salesGroupNumber)), 0);
  return formatSalesGroupNumber(maxSequence + 1);
}

async function resolveSalesGroupNumberForEnquiry(enquiry, client = prisma) {
  const existing = await client.order.findFirst({
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
  return normalizeSalesGroupNumber(existing?.salesGroupNumber) || getNextSalesGroupNumber(client);
}

async function hasOrderDispatchDateColumn() {
  if (typeof hasDispatchDateColumnCache === "boolean") return hasDispatchDateColumnCache;
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Order'
      AND COLUMN_NAME = 'dispatchDate'
  `;
  const count = Number(rows?.[0]?.count ?? 0);
  hasDispatchDateColumnCache = count > 0;
  return hasDispatchDateColumnCache;
}

async function syncOrderDispatchStatus(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      quantity: true,
      dispatches: {
        select: {
          dispatchedQuantity: true
        }
      }
    }
  });
  if (!order) return;

  const delivered = getDeliveredQuantity(order.dispatches);
  const nextStatus = delivered <= 0
    ? "READY_FOR_DISPATCH"
    : delivered >= order.quantity
      ? "COMPLETED"
      : "PARTIALLY_DISPATCHED";

  await tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus }
  });
}

export async function getDispatchDashboard(query = {}) {
  const q = String(query.q || "").trim();
  const statusFilter = String(query.status || "all").trim().toLowerCase();
  const clientFilter = String(query.client || "").trim().toLowerCase();
  const dateFilter = String(query.date || "").trim();
  const paginated = String(query.paginated || "") === "1";
  const { page, take, skip } = buildPagination(query, { defaultLimit: 10, maxLimit: 100 });
  const cacheKey = buildCacheKey(DISPATCH_CACHE_PREFIX, {
    q: q || null,
    status: statusFilter || "all",
    client: clientFilter || null,
    date: dateFilter || null,
    paginated,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, DISPATCH_CACHE_TTL_MS, async () => {
    const [dispatchableOrders, dispatches, approvedEnquiriesPendingDispatchDate, approvedManualRequestsPendingDispatchDate, existingOrdersForSalesGroups] = await Promise.all([
      prisma.order.findMany({
        where: {
          status: {
            in: ["READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"]
          },
          production: {
            status: "COMPLETED"
          },
          ...(q
            ? {
                OR: [
                  { salesOrderNumber: { contains: q } },
                  { salesGroupNumber: { contains: q } },
                  { orderNo: { contains: q } },
                  { clientName: { contains: q } },
                  { product: { contains: q } },
                  { enquiry: { enquiryNumber: { contains: q } } }
                ]
              }
            : {})
        },
        select: {
          id: true,
          salesOrderNumber: true,
          salesGroupNumber: true,
          orderNo: true,
          product: true,
          quantity: true,
          price: true,
          currency: true,
          unit: true,
          packingType: true,
          packingSize: true,
          deliveryDate: true,
          clientName: true,
          city: true,
          pincode: true,
          state: true,
          countryCode: true,
          status: true,
          updatedAt: true,
          production: {
            select: {
              id: true,
              status: true,
              productionCompletionDate: true
            }
          },
          dispatches: {
            select: {
              id: true,
              dispatchedQuantity: true,
              dispatchDate: true,
              shipmentStatus: true
            },
            orderBy: {
              createdAt: "desc"
            }
          }
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
      }),
      prisma.dispatch.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { order: { salesOrderNumber: { contains: q } } },
                  { order: { salesGroupNumber: { contains: q } } },
                  { order: { orderNo: { contains: q } } },
                  { order: { clientName: { contains: q } } },
                  { order: { enquiry: { enquiryNumber: { contains: q } } } }
                ]
              }
            : {})
        },
        select: DISPATCH_LIST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.enquiry.findMany({
        where: {
          status: "ACCEPTED",
          order: null,
          ...(q
            ? {
                OR: [
                  { companyName: { contains: q } },
                  { enquiryNumber: { contains: q } },
                  { product: { contains: q } }
                ]
              }
            : {})
        },
        select: {
          id: true,
          enquiryNumber: true,
          companyName: true,
          product: true,
          products: true,
          quantity: true,
          price: true,
          currency: true,
          unitOfMeasurement: true,
          expectedTimeline: true,
          assignedPerson: true,
          status: true,
          createdAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.manualOrderRequest.findMany({
        where: {
          status: "APPROVED",
          orderId: null,
          ...(q
            ? {
                OR: [
                  { requestNumber: { contains: q } },
                  { clientName: { contains: q } },
                  { product: { contains: q } }
                ]
              }
            : {})
        },
        select: MANUAL_ORDER_REQUEST_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }]
      }),
      prisma.order.findMany({
        select: {
          salesGroupNumber: true,
          enquiry: {
            select: {
              enquiryNumber: true
            }
          }
        }
      })
    ]);

    const salesGroupByKey = new Map();
    let nextSalesGroupSequence = existingOrdersForSalesGroups.reduce(
      (max, row) => Math.max(max, extractSalesGroupSequence(row.salesGroupNumber)),
      0
    ) + 1;

    for (const order of existingOrdersForSalesGroups) {
      const key = String(order.enquiry?.enquiryNumber || "").trim();
      const normalized = normalizeSalesGroupNumber(order.salesGroupNumber);
      if (key && normalized && !salesGroupByKey.has(key)) {
        salesGroupByKey.set(key, normalized);
      }
    }

    const readyOrders = dispatchableOrders
      .map((order) => {
        const deliveredQuantity = getDeliveredQuantity(order.dispatches);
        const remainingQuantity = Math.max(order.quantity - deliveredQuantity, 0);
        return {
          ...order,
          deliveredQuantity,
          remainingQuantity
        };
      })
      .filter((order) => order.remainingQuantity > 0);

    const filteredReadyOrders = readyOrders.filter((order) => {
      const matchesStatus = statusFilter === "all" || statusFilter === "pending";
      const matchesClient = clientFilter ? String(order.clientName || "").toLowerCase().includes(clientFilter) : true;
      const matchesDate = dateFilter ? normalizeDateKey(order.deliveryDate) === dateFilter : true;
      return matchesStatus && matchesClient && matchesDate;
    });

    const filteredDispatches = dispatches.filter((dispatch) => {
      const currentStatus = String(dispatch.shipmentStatus || "").toLowerCase();
      const matchesStatus = statusFilter === "all"
        ? true
        : statusFilter === "pending"
          ? currentStatus === "packing"
          : currentStatus === statusFilter;
      const matchesClient = clientFilter
        ? String(dispatch.order?.clientName || "").toLowerCase().includes(clientFilter)
        : true;
      const matchesDate = dateFilter ? normalizeDateKey(dispatch.dispatchDate) === dateFilter : true;
      return matchesStatus && matchesClient && matchesDate;
    });

    const dispatchDateOrders = approvedEnquiriesPendingDispatchDate.map((enquiry) => {
      const key = String(enquiry.enquiryNumber || "").trim();
      let salesGroupNumber = salesGroupByKey.get(key);
      if (!salesGroupNumber) {
        salesGroupNumber = formatSalesGroupNumber(nextSalesGroupSequence++);
        if (key) {
          salesGroupByKey.set(key, salesGroupNumber);
        }
      }

      return {
        id: enquiry.id,
        source: "ENQUIRY",
        salesOrderNumber: salesGroupNumber,
        salesGroupNumber,
        orderNo: "-",
        product: formatEnquiryProducts(enquiry.products, enquiry.product),
        quantity: enquiry.quantity,
        price: enquiry.price,
        currency: enquiry.currency,
        unit: enquiry.unitOfMeasurement || "KG",
        clientName: enquiry.companyName,
        deliveryDate: enquiry.expectedTimeline,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        dispatchDate: enquiry.expectedTimeline
      };
    });

    const manualSalesByKey = new Map();
    const manualDispatchDateOrders = approvedManualRequestsPendingDispatchDate.map((request) => {
      const key = String(request.requestNumber || `manual-${request.id}`).trim();
      let salesGroupNumber = manualSalesByKey.get(key);
      if (!salesGroupNumber) {
        salesGroupNumber = formatSalesGroupNumber(nextSalesGroupSequence++);
        manualSalesByKey.set(key, salesGroupNumber);
      }

      return {
        id: request.id,
        source: "MANUAL_REQUEST",
        salesOrderNumber: request.requestNumber || `MOR_${String(request.id).padStart(6, "0")}`,
        salesGroupNumber,
        orderNo: "-",
        product: request.product,
        packingType: request.packingType,
        packingSize: request.packingSize,
        quantity: request.quantity,
        unit: request.unit || "KG",
        clientName: request.clientName,
        address: request.address,
        deliveryDate: request.dispatchDate || request.createdAt,
        status: request.status,
        createdAt: request.createdAt,
        dispatchDate: request.dispatchDate,
        city: request.city,
        pincode: request.pincode,
        state: request.state,
        countryCode: request.countryCode
      };
    });

    const combinedDispatchDateOrders = [...dispatchDateOrders, ...manualDispatchDateOrders].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    if (!paginated) {
      return { readyOrders: filteredReadyOrders, dispatches: filteredDispatches, dispatchDateOrders: combinedDispatchDateOrders };
    }

    const autoRows = filteredDispatches.map((dispatch) => ({
      key: `dispatch-${dispatch.id}`,
      order: dispatch.order,
      dispatch
    }));
    const manualRows = filteredReadyOrders.map((order) => ({
      key: `ready-${order.id}`,
      order,
      dispatch: null
    }));
    const combinedRows = [...autoRows, ...manualRows];

    if (take > 0) {
      const pagedItems = combinedRows.slice(skip, skip + take);
      return {
        items: pagedItems,
        pagination: {
          page,
          limit: take,
          total: combinedRows.length,
          totalPages: Math.max(1, Math.ceil(combinedRows.length / take))
        }
      };
    }

    return {
      items: combinedRows,
      pagination: {
        page: 1,
        limit: 0,
        total: combinedRows.length,
        totalPages: 1
      }
    };
  });
}

export async function updateOrderDispatchDate(enquiryId, payload, actorUser) {
  const dispatchDate = parseDateInput(payload.dispatch_date);
  if (!dispatchDate) {
    const error = new Error("Dispatch date is required.");
    error.statusCode = 400;
    throw error;
  }

  const enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: {
        id: true,
        enquiryNumber: true,
        status: true,
        companyName: true,
        product: true,
        products: true,
        quantity: true,
        unitOfMeasurement: true,
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
    const error = new Error("Only approved enquiries can be converted to order.");
    error.statusCode = 400;
    throw error;
  }

  if (enquiry.order) {
    const error = new Error("Order already exists for this enquiry.");
    error.statusCode = 409;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    const hasDispatchDateColumn = await hasOrderDispatchDateColumn();
    const validUnits = new Set(["KG", "MT", "LTR"]);
    const unit = validUnits.has(enquiry.unitOfMeasurement) ? enquiry.unitOfMeasurement : "KG";

    const salesGroupNumber = await resolveSalesGroupNumberForEnquiry(enquiry, tx);

    const createdOrder = await tx.order.create({
      data: {
        enquiryId: enquiry.id,
        createdById: actorUser.id,
        salesOrderNumber: `TSO-${Date.now()}-${enquiry.id}`,
        salesGroupNumber,
        orderNo: `TMP-${Date.now()}-${enquiry.id}`,
        product: getPrimaryEnquiryProduct(enquiry),
        grade: "NA",
        quantity: enquiry.quantity,
        price: enquiry.price ?? null,
        currency: enquiry.currency ?? null,
        unit,
        packingType: "NA",
        packingSize: "NA",
        deliveryDate: dispatchDate,
        clientName: enquiry.companyName,
        address: "",
        city: "",
        pincode: "",
        state: "",
        countryCode: "IN",
        remarks: `Created from approved enquiry #${enquiry.id} via dispatch date`,
        status: "CREATED",
        ...(hasDispatchDateColumn ? { dispatchDate } : {})
      },
      select: {
        id: true
      }
    });

    const updated = await tx.order.update({
      where: { id: createdOrder.id },
      data: {
        salesOrderNumber: formatSalesOrderNumber(createdOrder.id),
        orderNo: generateOrderNo(createdOrder.id)
      },
      select: {
        id: true,
        salesOrderNumber: true,
        orderNo: true
      }
    });

    await recordAuditEvent({
      tx,
      action: "CREATE_ORDER",
      entityType: "Order",
      entityId: updated.id,
      user: actorUser,
      oldValue: null,
      newValue: {
        enquiryId: enquiry.id,
        salesOrderNumber: updated.salesOrderNumber,
        dispatchDate
      },
      note: `Created order #${updated.id} from approved enquiry #${enquiry.id} with dispatch date`
    });

    return updated;
  });
  invalidateDispatchReadCaches();
  return result;
}

export async function createDispatch(payload, actorUser) {
  const dispatchDateValue = parseDateInput(payload.dispatch_date);
  if (!dispatchDateValue) {
    const error = new Error("Dispatch date is required.");
    error.statusCode = 400;
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id: payload.order_id },
    select: {
      id: true,
      quantity: true,
      status: true,
      salesOrderNumber: true,
      clientName: true,
      production: {
        select: {
          id: true,
          status: true
        }
      },
      dispatches: {
        select: {
          dispatchedQuantity: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!order.production || order.production.status !== "COMPLETED") {
    const error = new Error("Cannot dispatch unless production is completed.");
    error.statusCode = 400;
    throw error;
  }

  const deliveredQuantity = getDeliveredQuantity(order.dispatches);
  const remainingQuantity = Math.max(order.quantity - deliveredQuantity, 0);
  if (remainingQuantity <= 0) {
    const error = new Error("Order is already fully dispatched.");
    error.statusCode = 409;
    throw error;
  }
  if (payload.dispatch_quantity > remainingQuantity) {
    const error = new Error(`Dispatch quantity cannot exceed remaining quantity (${remainingQuantity}).`);
    error.statusCode = 400;
    throw error;
  }
  validateDeliveredShipmentStatus(payload.shipment_status, payload.dispatch_quantity, remainingQuantity);

  const dispatch = await prisma.$transaction(async (tx) => {
    const created = await tx.dispatch.create({
      data: {
        orderId: payload.order_id,
        dispatchedQuantity: payload.dispatch_quantity,
        dispatchDate: dispatchDateValue,
        packingDone: payload.packing_done,
        shipmentStatus: payload.shipment_status,
        remarks: payload.remarks
      },
      select: DISPATCH_LIST_SELECT
    });

    await syncOrderDispatchStatus(tx, payload.order_id);
    await recordAuditEvent({
      tx,
      action: "CREATE_DISPATCH",
      entityType: "Dispatch",
      entityId: created.id,
      user: actorUser,
      newValue: created,
      note: `Created dispatch for order #${payload.order_id}`
    });
    return created;
  });

  invalidateDispatchReadCaches();
  return dispatch;
}

export async function updateDispatch(dispatchId, payload, actorUser) {
  const parsedDispatchDate = payload.dispatch_date ? parseDateInput(payload.dispatch_date) : undefined;
  if (payload.dispatch_date && !parsedDispatchDate) {
    const error = new Error("Dispatch date is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      id: true,
      orderId: true,
      dispatchedQuantity: true,
      dispatchDate: true,
      packingDone: true,
      shipmentStatus: true,
      remarks: true,
      order: {
        select: {
          id: true,
          quantity: true,
          dispatches: {
            select: {
              id: true,
              dispatchedQuantity: true
            }
          }
        }
      }
    }
  });

  if (!dispatch) {
    const error = new Error("Dispatch record not found.");
    error.statusCode = 404;
    throw error;
  }

  const currentTotal = getDeliveredQuantity(dispatch.order.dispatches);
  const currentRowQty = dispatch.dispatchedQuantity || 0;
  const incomingQty = payload.dispatch_quantity ?? currentRowQty;
  const remainingWithoutCurrent = Math.max(dispatch.order.quantity - (currentTotal - currentRowQty), 0);
  if (incomingQty > remainingWithoutCurrent) {
    const error = new Error(`Dispatch quantity cannot exceed remaining quantity (${remainingWithoutCurrent}).`);
    error.statusCode = 400;
    throw error;
  }
  validateDeliveredShipmentStatus(
    payload.shipment_status ?? dispatch.shipmentStatus,
    incomingQty,
    remainingWithoutCurrent
  );

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.dispatch.update({
      where: { id: dispatchId },
      data: {
        dispatchedQuantity: payload.dispatch_quantity,
        dispatchDate: parsedDispatchDate,
        packingDone: payload.packing_done,
        shipmentStatus: payload.shipment_status,
        remarks: payload.remarks
      },
      select: DISPATCH_LIST_SELECT
    });

    await syncOrderDispatchStatus(tx, dispatch.orderId);
    await recordAuditEvent({
      tx,
      action: "UPDATE_DISPATCH",
      entityType: "Dispatch",
      entityId: dispatchId,
      user: actorUser,
      oldValue: dispatch,
      newValue: updated,
      note: `Updated dispatch #${dispatchId}`
    });
    return updated;
  });
  invalidateDispatchReadCaches();
  return result;
}

export async function deleteDispatch(dispatchId, actorUser) {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      id: true,
      orderId: true
    }
  });

  if (!dispatch) {
    const error = new Error("Dispatch record not found.");
    error.statusCode = 404;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_DISPATCH",
      entityType: "Dispatch",
      entityId: dispatchId,
      user: actorUser,
      oldValue: dispatch,
      note: `Deleted dispatch #${dispatchId}`
    });

    await tx.dispatch.delete({ where: { id: dispatchId } });
    await syncOrderDispatchStatus(tx, dispatch.orderId);
  });

  invalidateDispatchReadCaches();
  return { id: dispatchId };
}
