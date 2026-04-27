import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { ORDER_LIST_SELECT } from "../utils/selects.js";
import { getPrimaryEnquiryProduct } from "../utils/enquiryProducts.js";
import { ensureProductsExist } from "../utils/productCatalog.js";
import { getCustomerMasterProfileByName } from "../utils/customerCatalog.js";
import { normalizeCurrencyInput, normalizePriceInput } from "../utils/commerce.js";
import {
  extractSalesGroupSequence,
  formatSalesGroupNumber,
  formatSalesOrderNumber,
  normalizeSalesGroupNumber
} from "../utils/businessNumbers.js";

const ORDER_CACHE_PREFIX = "orders:list";
const ORDER_CACHE_TTL_MS = 12 * 1000;

function generateOrderNo(id) {
  return `ORD-${String(id).padStart(6, "0")}`;
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

async function getNextSalesGroupNumber() {
  const existing = await prisma.order.findMany({
    select: {
      salesGroupNumber: true
    }
  });
  const maxSequence = existing.reduce((max, row) => Math.max(max, extractSalesGroupSequence(row.salesGroupNumber)), 0);
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
    unit: payload.unit,
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
    unit: payload.unit,
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
        grade: true,
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

  await recordAuditEvent({
    action: "CREATE_ORDER",
    entityType: "Order",
    entityId: finalOrder.id,
    user: createdByUser,
    newValue: finalOrder,
    note: enquiryId
      ? `Created order #${finalOrder.id} from enquiry #${enquiryId}`
      : `Created manual order #${finalOrder.id}`
  });

  invalidateOrderReadCaches();
  return finalOrder;
}

export async function listOrders(filters = {}) {
  const { status, q, client, date } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });
  const normalizedClient = String(client || "").trim();
  const normalizedDate = String(date || "").trim();
  const dateFrom = normalizedDate ? new Date(`${normalizedDate}T00:00:00.000Z`) : null;
  const dateTo = normalizedDate ? new Date(`${normalizedDate}T23:59:59.999Z`) : null;

  const where = {
    ...(status ? { status } : {}),
    ...(normalizedClient ? { clientName: { contains: normalizedClient } } : {}),
    ...(normalizedDate && dateFrom && dateTo ? { deliveryDate: { gte: dateFrom, lte: dateTo } } : {}),
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
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  };

  const cacheKey = buildCacheKey(ORDER_CACHE_PREFIX, {
    status: status || null,
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

export async function moveOrderToProduction(orderId, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      production: {
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

  if (order.production) {
    const error = new Error("Production already exists for this order.");
    error.statusCode = 409;
    throw error;
  }

  if (isDispatchLifecycleStatus(order.status) || order.status === "IN_PRODUCTION") {
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

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: "IN_PRODUCTION" },
    select: ORDER_LIST_SELECT
  });

  await recordAuditEvent({
    action: "START_PRODUCTION",
    entityType: "Order",
    entityId: orderId,
    user: actorUser,
    oldValue: { status: order.status },
    newValue: { status: "IN_PRODUCTION" },
    note: `Moved order #${orderId} to production`
  });

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
      production: {
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

  if (order.production || (order.dispatches && order.dispatches.length > 0)) {
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

  await recordAuditEvent({
    action: "UPDATE_ORDER",
    entityType: "Order",
    entityId: orderId,
    user: actorUser,
    oldValue: order,
    newValue: updatedOrder,
    note: `Updated order #${orderId}`
  });

  invalidateOrderReadCaches();
  return updatedOrder;
}

export async function deleteOrder(orderId, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      production: {
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

  if (order.production || (order.dispatches && order.dispatches.length > 0)) {
    const error = new Error("Cannot delete order with production/dispatch records.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_ORDER",
      entityType: "Order",
      entityId: orderId,
      user: actorUser,
      oldValue: order,
      note: `Deleted order #${orderId}`
    });

    await tx.order.delete({
      where: { id: orderId }
    });

    return { id: orderId };
  });

  invalidateOrderReadCaches();
  return result;
}
