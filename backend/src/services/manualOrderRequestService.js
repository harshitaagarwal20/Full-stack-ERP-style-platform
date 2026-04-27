import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { MANUAL_ORDER_REQUEST_SELECT, ORDER_LIST_SELECT } from "../utils/selects.js";
import { formatEnquiryProducts, normalizeEnquiryProductRows } from "../utils/enquiryProducts.js";
import { ensureProductsExist } from "../utils/productCatalog.js";
import { getCustomerMasterProfileByName } from "../utils/customerCatalog.js";
import {
  extractSalesGroupSequence,
  formatManualOrderRequestNumber,
  formatSalesGroupNumber,
  formatSalesOrderNumber,
  normalizeSalesGroupNumber
} from "../utils/businessNumbers.js";

const MANUAL_ORDER_REQUEST_CACHE_PREFIX = "manual-orders:list";
const MANUAL_ORDER_REQUEST_CACHE_TTL_MS = 12 * 1000;

function invalidateManualOrderRequestCaches() {
  invalidateCacheByPrefix("manual-orders:");
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("production:");
  invalidateCacheByPrefix("dashboard:");
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeText(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function buildManualOrderCreateData(request, actorUser, customerProfile, salesGroupNumber) {
  const product = normalizeText(request.product, "NA");
  const grade = normalizeText(request.grade, "NA");
  const unit = normalizeText(request.unit, "KG");
  const packingType = normalizeText(request.packingType, "NA");
  const packingSize = normalizeText(request.packingSize, "NA");
  const clientName = normalizeText(request.clientName, customerProfile?.customerName || "Unknown Customer");

  return {
    createdById: actorUser.id,
    salesGroupNumber: normalizeSalesGroupNumber(salesGroupNumber),
    salesOrderNumber: `TSO-${Date.now()}-${request.id}`,
    orderNo: `TMP-${Date.now()}-${request.id}`,
    product,
    grade,
    quantity: Number(request.quantity || 1),
    unit,
    packingType,
    packingSize,
    deliveryDate: request.dispatchDate,
    dispatchDate: request.dispatchDate,
    clientName,
    address: customerProfile?.address || request.address || null,
    city: customerProfile?.city || request.city || null,
    pincode: customerProfile?.pincode || request.pincode || null,
    state: customerProfile?.state || request.state || null,
    countryCode: customerProfile?.countryCode || request.countryCode || null,
    remarks: request.remarks || `Created from manual order request #${request.requestNumber}`,
    status: "CREATED"
  };
}

async function getNextSalesGroupNumber(tx) {
  const existing = await tx.order.findMany({
    select: {
      salesGroupNumber: true
    }
  });
  const maxSequence = existing.reduce((max, row) => Math.max(max, extractSalesGroupSequence(row.salesGroupNumber)), 0);
  return formatSalesGroupNumber(maxSequence + 1);
}

export async function resolveSalesGroupNumberForManualRequest(request, client = prisma) {
  const requestNumber = String(request?.requestNumber || "").trim();
  if (!requestNumber) {
    return getNextSalesGroupNumber(client);
  }

  const existing = await client.order.findFirst({
    where: {
      manualOrderRequest: {
        requestNumber
      }
    },
    select: {
      salesGroupNumber: true
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  return normalizeSalesGroupNumber(existing?.salesGroupNumber) || getNextSalesGroupNumber(client);
}

function extractManualRequestSequence(requestNumber) {
  const match = String(requestNumber || "").trim().match(/^MOR[_-](\d{4})$/i);
  if (!match) return 0;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

async function getNextManualOrderRequestNumber(tx) {
  const existing = await tx.manualOrderRequest.findMany({
    select: {
      requestNumber: true
    }
  });
  const maxSequence = existing.reduce((max, row) => Math.max(max, extractManualRequestSequence(row.requestNumber)), 0);
  return formatManualOrderRequestNumber(maxSequence + 1);
}

async function createOrderFromManualRequest(request, actorUser) {
  const requestDispatchDate = request.dispatchDate;
  if (!requestDispatchDate) {
    const error = new Error("Dispatch date is required before creating the order.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const customerProfile = await getCustomerMasterProfileByName(request.clientName);
    const salesGroupNumber = await resolveSalesGroupNumberForManualRequest(request, tx);
    const orderCreateData = buildManualOrderCreateData(request, actorUser, customerProfile, salesGroupNumber);

    const order = await tx.order.create({
      data: orderCreateData
    });

    const finalOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        salesOrderNumber: formatSalesOrderNumber(order.id),
        orderNo: `ORD-${String(order.id).padStart(6, "0")}`
      },
      select: ORDER_LIST_SELECT
    });

    await tx.manualOrderRequest.update({
      where: { id: request.id },
      data: {
        status: "ORDER_CREATED",
        dispatchDate: requestDispatchDate,
        orderId: finalOrder.id
      }
    });

    await recordAuditEvent({
      tx,
      action: "CREATE_ORDER",
      entityType: "Order",
      entityId: finalOrder.id,
      user: actorUser,
      newValue: finalOrder,
      note: `Created order #${finalOrder.id} from manual request #${request.requestNumber}`
    });

    return finalOrder;
  });
}

export async function createManualOrderRequest(payload, createdByUser) {
  const productRows = normalizeEnquiryProductRows(payload.products ?? payload.product);
  const products = await ensureProductsExist(productRows);
  const clientName = normalizeText(payload.client_name);
  if (!clientName) {
    const error = new Error("Client name is required.");
    error.statusCode = 400;
    throw error;
  }
  const normalizedProducts = products.map((product, index) => ({
    product,
    grade: normalizeText(productRows[index]?.grade || payload.grade, "NA"),
    quantity: Number(productRows[index]?.quantity || payload.quantity || 0) || 1,
    unit: normalizeText(productRows[index]?.unit_of_measurement || payload.unit, "KG")
  }));
  const requestDispatchDate = parseDateInput(payload.delivery_date || payload.dispatch_date);
  if (!requestDispatchDate) {
    const error = new Error("Expected timeline is required.");
    error.statusCode = 400;
    throw error;
  }
  const packingType = String(payload.packing_type || "").trim() || "NA";
  const packingSize = String(payload.packing_size || "").trim() || "NA";

  const request = await prisma.$transaction(async (tx) => {
    const requestNumber = await getNextManualOrderRequestNumber(tx);
    const createdRows = [];

    for (const row of normalizedProducts) {
      const createdRow = await tx.manualOrderRequest.create({
        data: {
          requestNumber,
          product: row.product,
          grade: row.grade,
          quantity: row.quantity,
          unit: row.unit,
          packingType,
          packingSize,
          clientName,
          address: payload.address || null,
          city: payload.city || null,
          pincode: payload.pincode || null,
          state: payload.state || null,
          countryCode: payload.country_code || null,
          dispatchDate: requestDispatchDate,
          remarks: payload.remarks || (normalizedProducts.length > 1 ? `Created from manual request ${requestNumber}: ${formatEnquiryProducts([row])}` : null),
          status: "REQUESTED",
          createdById: createdByUser.id
        },
        select: MANUAL_ORDER_REQUEST_SELECT
      });
      createdRows.push(createdRow);
    }

    return createdRows.length === 1 ? createdRows[0] : createdRows;
  });

  invalidateManualOrderRequestCaches();
  return request;
}

export { buildManualOrderCreateData };

export async function listManualOrderRequests(filters = {}) {
  const { status, q } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });
  const normalizedStatus = String(status || "").trim();

  const where = {
    ...(normalizedStatus ? { status: normalizedStatus } : {}),
    ...(q
      ? {
          OR: [
            { requestNumber: { contains: q } },
            { clientName: { contains: q } },
            { product: { contains: q } },
            { remarks: { contains: q } }
          ]
        }
      : {})
  };

  const cacheKey = buildCacheKey(MANUAL_ORDER_REQUEST_CACHE_PREFIX, {
    status: normalizedStatus || null,
    q: q || null,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, MANUAL_ORDER_REQUEST_CACHE_TTL_MS, async () => {
    const query = {
      where,
      select: MANUAL_ORDER_REQUEST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    };

    if (take > 0) {
      const [items, total] = await Promise.all([
        prisma.manualOrderRequest.findMany({ ...query, skip, take }),
        prisma.manualOrderRequest.count({ where })
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

    return prisma.manualOrderRequest.findMany(query);
  });
}

export async function updateManualOrderRequestStatus(requestId, status, actorUser) {
  const request = await prisma.manualOrderRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      orderId: true
    }
  });

  if (!request) {
    const error = new Error("Manual order request not found.");
    error.statusCode = 404;
    throw error;
  }

  if (request.status !== "REQUESTED") {
    const error = new Error("Manual order request can only be approved or rejected once.");
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.manualOrderRequest.update({
      where: { id: requestId },
      data: {
        status,
        approvedById: actorUser.id
      },
      select: MANUAL_ORDER_REQUEST_SELECT
    });

    await recordAuditEvent({
      tx,
      action: status === "APPROVED" ? "APPROVE_MANUAL_ORDER_REQUEST" : "REJECT_MANUAL_ORDER_REQUEST",
      entityType: "ManualOrderRequest",
      entityId: requestId,
      user: actorUser,
      oldValue: request,
      newValue: next,
      note: `${status === "APPROVED" ? "Approved" : "Rejected"} manual order request #${requestId}`
    });

    return next;
  });

  invalidateManualOrderRequestCaches();
  return updated;
}

export async function setManualOrderDispatchDate(requestId, payload, actorUser) {
  const dispatchDate = parseDateInput(payload.dispatch_date);
  if (!dispatchDate) {
    const error = new Error("Dispatch date is required.");
    error.statusCode = 400;
    throw error;
  }

  const request = await prisma.manualOrderRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      requestNumber: true,
      product: true,
      grade: true,
      quantity: true,
      unit: true,
      packingType: true,
      packingSize: true,
      clientName: true,
      address: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      remarks: true,
      status: true,
      dispatchDate: true,
      orderId: true
    }
  });

  if (!request) {
    const error = new Error("Manual order request not found.");
    error.statusCode = 404;
    throw error;
  }

  if (request.orderId) {
    const error = new Error("Order already created for this manual request.");
    error.statusCode = 409;
    throw error;
  }

  if (request.status !== "APPROVED") {
    const error = new Error("Manual order request must be approved before creating the order.");
    error.statusCode = 400;
    throw error;
  }

  const order = await createOrderFromManualRequest({ ...request, dispatchDate }, actorUser);
  const updatedRequest = await prisma.manualOrderRequest.findUnique({
    where: { id: requestId },
    select: MANUAL_ORDER_REQUEST_SELECT
  });

  await recordAuditEvent({
    action: "SET_MANUAL_ORDER_DISPATCH_DATE",
    entityType: "ManualOrderRequest",
    entityId: requestId,
    user: actorUser,
    oldValue: request,
    newValue: updatedRequest,
    note: `Created order #${order.id} from manual order request #${requestId}`
  });

  invalidateManualOrderRequestCaches();
  return { request: updatedRequest, order };
}
