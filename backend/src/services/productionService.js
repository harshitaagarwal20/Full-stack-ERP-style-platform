import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { PRODUCTION_LIST_SELECT } from "../utils/selects.js";

const PRODUCTION_CACHE_PREFIX = "production:list";
const PRODUCTION_CACHE_TTL_MS = 12 * 1000;
const MAX_PRODUCTION_STATUS_CHANGES = 2;
let hasStatusChangeCountColumnCache;

function invalidateProductionReadCaches() {
  invalidateCacheByPrefix("production:");
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("dashboard:");
}

function isNonEmpty(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizePositiveIntegerInput(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    const error = new Error(`${fieldName} must be a positive integer.`);
    error.statusCode = 400;
    throw error;
  }

  return numeric;
}

function normalizeTrimmedInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeNullableTrimmedInput(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function hasProductionStatusChangeCountColumn() {
  if (typeof hasStatusChangeCountColumnCache === "boolean") {
    return hasStatusChangeCountColumnCache;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'Production'
       AND COLUMN_NAME = 'statusChangeCount'`
  );

  hasStatusChangeCountColumnCache = Number(rows?.[0]?.total || 0) > 0;
  return hasStatusChangeCountColumnCache;
}

async function getProductionStatusChangeCount(productionId) {
  if (await hasProductionStatusChangeCountColumn()) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT \`statusChangeCount\` AS total
       FROM \`Production\`
       WHERE \`id\` = ?`,
      productionId
    );

    return Number(rows?.[0]?.total || 0);
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total
     FROM \`AuditLog\`
     WHERE \`action\` = 'UPDATE_PRODUCTION'
       AND \`entityType\` = 'Production'
       AND \`entityId\` = ?
       AND JSON_UNQUOTE(JSON_EXTRACT(\`oldValue\`, '$.status')) <> JSON_UNQUOTE(JSON_EXTRACT(\`newValue\`, '$.status'))`,
    productionId
  );

  return Number(rows?.[0]?.total || 0);
}

export function buildProductionUpdateData(payload = {}, production = {}) {
  const updateData = {};

  const assignedPersonnel = normalizeTrimmedInput(payload.assigned_personnel);
  if (assignedPersonnel !== undefined) {
    updateData.assignedPersonnel = assignedPersonnel;
  }

  if (payload.delivery_date !== undefined && String(payload.delivery_date).trim()) {
    const parsedDate = parseDateInput(payload.delivery_date);
    if (parsedDate) {
      updateData.deliveryDate = parsedDate;
    }
  }

  const productSpecs = normalizeTrimmedInput(payload.product_specs);
  if (productSpecs !== undefined) {
    updateData.productSpecs = productSpecs;
  }

  const capacity = normalizePositiveIntegerInput(payload.capacity, "Capacity");
  if (capacity !== undefined) {
    updateData.capacity = capacity;
  }

  const particleSize = normalizeTrimmedInput(payload.particle_size);
  if (particleSize !== undefined) {
    updateData.particleSize = particleSize;
  }

  const acmRpm = normalizePositiveIntegerInput(payload.acm_rpm, "ACM RPM");
  if (acmRpm !== undefined) {
    updateData.acmRpm = acmRpm;
  }

  const classifierRpm = normalizePositiveIntegerInput(payload.classifier_rpm, "Classifier RPM");
  if (classifierRpm !== undefined) {
    updateData.classifierRpm = classifierRpm;
  }

  const blowerRpm = normalizePositiveIntegerInput(payload.blower_rpm, "Blower RPM");
  if (blowerRpm !== undefined) {
    updateData.blowerRpm = blowerRpm;
  }

  const rawMaterials = normalizeTrimmedInput(payload.raw_materials);
  if (rawMaterials !== undefined) {
    updateData.rawMaterials = rawMaterials;
  }

  if (payload.remarks !== undefined) {
    updateData.remarks = normalizeNullableTrimmedInput(payload.remarks);
  }

  if (payload.status !== undefined) {
    const nextStatus = payload.status;
    const isStatusChange = nextStatus !== production.status;
    const statusChangeCount = Number(production.statusChangeCount || 0);

    if (production.status === "COMPLETED" && isStatusChange) {
      const error = new Error("Production status cannot be changed after completion.");
      error.statusCode = 400;
      throw error;
    }

    if (isStatusChange && statusChangeCount >= MAX_PRODUCTION_STATUS_CHANGES) {
      const error = new Error("Status update is allowed only twice.");
      error.statusCode = 400;
      throw error;
    }

    updateData.status = nextStatus;
  }

  if (payload.state !== undefined) {
    updateData.state = normalizeNullableTrimmedInput(payload.state);
  }

  return updateData;
}

export async function createProduction(payload, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: payload.order_id },
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
      salesOrderNumber: true,
      production: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Cannot start production without valid order.");
    error.statusCode = 400;
    throw error;
  }

  if (order.status !== "CREATED" && order.status !== "IN_PRODUCTION") {
    const error = new Error("Only orders from order slab can be sent to production.");
    error.statusCode = 400;
    throw error;
  }

  if (order.production) {
    const error = new Error("Production already started for this order.");
    error.statusCode = 409;
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

  const assignedPersonnel = normalizeTrimmedInput(payload.assigned_personnel) || order.clientName || "Production Team";
  const parsedDeliveryDate = parseDateInput(payload.delivery_date);
  const deliveryDateValue = parsedDeliveryDate || new Date(order.deliveryDate || new Date());
  const productSpecs = normalizeTrimmedInput(payload.product_specs) || `${order.product} ${order.grade ? `(${order.grade})` : ""}`.trim();
  const capacity = normalizePositiveIntegerInput(payload.capacity, "Capacity") ?? normalizePositiveIntegerInput(order.quantity, "Order quantity") ?? 1;
  const particleSize = normalizeTrimmedInput(payload.particle_size) || "NA";
  const acmRpm = normalizePositiveIntegerInput(payload.acm_rpm, "ACM RPM") ?? 1000;
  const classifierRpm = normalizePositiveIntegerInput(payload.classifier_rpm, "Classifier RPM") ?? 1000;
  const blowerRpm = normalizePositiveIntegerInput(payload.blower_rpm, "Blower RPM") ?? 1000;
  const rawMaterials = normalizeTrimmedInput(payload.raw_materials) || order.packingType || "NA";
  const remarks = payload.remarks ?? `Auto-generated from order ${order.salesOrderNumber}`;

  const production = await prisma.production.create({
    data: {
      orderId: payload.order_id,
      assignedPersonnel,
      deliveryDate: deliveryDateValue,
      productSpecs,
      capacity,
      particleSize,
      acmRpm,
      classifierRpm,
      blowerRpm,
      rawMaterials,
      remarks,
      status: "PENDING",
      state: payload.state || null
    },
    select: PRODUCTION_LIST_SELECT
  });

  await prisma.order.update({
    where: { id: payload.order_id },
    data: { status: "IN_PRODUCTION" }
  });

  await recordAuditEvent({
    action: "START_PRODUCTION",
    entityType: "Production",
    entityId: production.id,
    user: actorUser,
    newValue: production,
    note: `Started production for order #${payload.order_id}`
  });

  invalidateProductionReadCaches();
  return production;
}

export async function listProductionOrders(filters = {}) {
  const { q, status, company, date } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });
  const normalizedCompany = String(company || "").trim();
  const normalizedDate = String(date || "").trim();
  const dateFrom = normalizedDate ? new Date(`${normalizedDate}T00:00:00.000Z`) : null;
  const dateTo = normalizedDate ? new Date(`${normalizedDate}T23:59:59.999Z`) : null;

  const where = {
    ...(status ? { status } : {}),
    ...(normalizedCompany ? { order: { clientName: { contains: normalizedCompany } } } : {}),
    ...(normalizedDate && dateFrom && dateTo ? { deliveryDate: { gte: dateFrom, lte: dateTo } } : {}),
    ...(q
      ? {
        OR: [
          { order: { orderNo: { contains: q } } },
          { order: { salesGroupNumber: { contains: q } } },
          { order: { enquiry: { enquiryNumber: { contains: q } } } },
          { order: { enquiry: { companyName: { contains: q } } } },
          { order: { enquiry: { product: { contains: q } } } },
          { assignedPersonnel: { contains: q } }
          ]
        }
      : {})
  };

  const query = {
    where,
    select: PRODUCTION_LIST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  };

  const cacheKey = buildCacheKey(PRODUCTION_CACHE_PREFIX, {
    q: q || null,
    status: status || null,
    company: normalizedCompany || null,
    date: normalizedDate || null,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, PRODUCTION_CACHE_TTL_MS, async () => {
    if (take > 0) {
      const [items, total] = await Promise.all([
        prisma.production.findMany({
          ...query,
          skip,
          take
        }),
        prisma.production.count({ where })
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

    return prisma.production.findMany(query);
  });
}

export async function markProductionComplete(productionId, actorUser, payload = {}) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      status: true,
      orderId: true,
      order: {
        select: {
          id: true,
          dispatches: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (production.status === "COMPLETED") {
    const error = new Error("Production already completed.");
    error.statusCode = 400;
    throw error;
  }

  const completionDate = parseDateInput(payload.completion_date) || new Date();

  await prisma.$transaction(async (tx) => {
    await tx.production.update({
      where: { id: productionId },
      data: {
        status: "COMPLETED",
        productionCompletionDate: completionDate
      }
    });

    await tx.order.update({
      where: { id: production.orderId },
      data: { status: "READY_FOR_DISPATCH" }
    });

    await recordAuditEvent({
      tx,
      action: "COMPLETE_PRODUCTION",
      entityType: "Production",
      entityId: productionId,
      user: actorUser,
      oldValue: { status: production.status },
      newValue: { status: "COMPLETED", productionCompletionDate: completionDate, orderStatus: "READY_FOR_DISPATCH" },
      note: `Completed production #${productionId}`
    });
  });

  const updated = await prisma.production.findUnique({
    where: { id: productionId },
    select: PRODUCTION_LIST_SELECT
  });
  invalidateProductionReadCaches();
  return updated;
}

export async function updateProduction(productionId, payload, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      status: true,
      state: true,
      orderId: true,
      assignedPersonnel: true,
      deliveryDate: true,
      productSpecs: true,
      capacity: true,
      particleSize: true,
      acmRpm: true,
      classifierRpm: true,
      blowerRpm: true,
      rawMaterials: true,
      remarks: true,
      productionCompletionDate: true
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  const statusChangeCount = await getProductionStatusChangeCount(productionId);
  const updateData = buildProductionUpdateData(payload, {
    ...production,
    statusChangeCount
  });

  if (Object.keys(updateData).length === 0) {
    const error = new Error("At least one production field must be provided.");
    error.statusCode = 400;
    throw error;
  }

  const updatedProduction = await prisma.$transaction(async (tx) => {
    const updated = await tx.production.update({
      where: { id: productionId },
      data: updateData,
      select: PRODUCTION_LIST_SELECT
    });

    if (payload.status !== undefined && payload.status !== production.status) {
      if (await hasProductionStatusChangeCountColumn()) {
        await tx.$executeRawUnsafe(
          `UPDATE \`Production\`
           SET \`statusChangeCount\` = \`statusChangeCount\` + 1
           WHERE \`id\` = ?`,
          productionId
        );
      }
    }

    await recordAuditEvent({
      tx,
      action: "UPDATE_PRODUCTION",
      entityType: "Production",
      entityId: productionId,
      user: actorUser,
      oldValue: production,
      newValue: updated,
      note: `Updated production #${productionId}`
    });

    return updated;
  });

  invalidateProductionReadCaches();
  return updatedProduction;
}

export async function deleteProduction(productionId, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      orderId: true,
      order: {
        select: {
          id: true,
          dispatches: {
            select: {
              id: true
            }
          }
        }
      }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (production.order.dispatches && production.order.dispatches.length > 0) {
    const error = new Error("Cannot delete production after dispatch starts.");
    error.statusCode = 400;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_PRODUCTION",
      entityType: "Production",
      entityId: productionId,
      user: actorUser,
      oldValue: production,
      note: `Deleted production #${productionId}`
    });

    await tx.production.delete({ where: { id: productionId } });

    await tx.order.update({
      where: { id: production.orderId },
      data: { status: "CREATED" }
    });
  });

  invalidateProductionReadCaches();
  return { id: productionId };
}
