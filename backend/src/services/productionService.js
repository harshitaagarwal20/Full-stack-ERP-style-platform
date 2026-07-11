import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { ORDER_LIST_SELECT, PRODUCTION_LIST_SELECT, PRODUCTION_DETAIL_SELECT, BATCH_SUBSTITUTION_SELECT } from "../utils/selects.js";
import { getAvailableInventoryQty } from "./inventoryService.js";

const SUBSTITUTION_SECTIONS = ["rm", "additives", "catalysts"];

function parseFullMfgBlob(rawMaterialsStr) {
  try {
    const parsed = JSON.parse(rawMaterialsStr || "{}");
    return {
      rm:            Array.isArray(parsed.rm)            ? parsed.rm            : [],
      additives:     Array.isArray(parsed.additives)     ? parsed.additives     : [],
      catalysts:     Array.isArray(parsed.catalysts)     ? parsed.catalysts     : [],
      pulveriserRpm: parsed.pulveriserRpm || "",
      equipment:     Array.isArray(parsed.equipment)     ? parsed.equipment     : [],
      processParams: Array.isArray(parsed.processParams) ? parsed.processParams : [],
      batchLogs:     Array.isArray(parsed.batchLogs)     ? parsed.batchLogs     : []
    };
  } catch {
    return { rm: [], additives: [], catalysts: [], pulveriserRpm: "", equipment: [], processParams: [], batchLogs: [] };
  }
}

const PRODUCTION_CACHE_PREFIX = "production:list";
const PRODUCTION_CACHE_TTL_MS = 0;
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

function parseRawMaterialLines(rawMaterialsStr) {
  if (!rawMaterialsStr) return [];
  try {
    const parsed = JSON.parse(rawMaterialsStr);
    const allItems = [
      ...(Array.isArray(parsed.rm)        ? parsed.rm        : []),
      ...(Array.isArray(parsed.additives) ? parsed.additives : []),
      ...(Array.isArray(parsed.catalysts) ? parsed.catalysts : [])
    ];
    return allItems.filter((item) => item.name && item.qty && Number(item.qty) > 0);
  } catch {
    return [];
  }
}

function buildConsumptionRows(rawMaterialsStr, productionId) {
  return parseRawMaterialLines(rawMaterialsStr).map((item) => ({
    type:      "OUT",
    itemId:    String(item.name).trim(),
    batchNo:   item.batch_no ? String(item.batch_no).trim() : null,
    shift:     item.shift ? String(item.shift).trim() : null,
    quantity:  Math.round(Number(item.qty)),
    reference: `Production #${productionId}`,
    remarks:   "Production consumption"
  }));
}

// Zeroes out any inventory already consumed by this production job, so it can
// be safely re-deducted (raw materials edited) or dropped (job deleted)
// without permanently losing track of the stock in the ledger. Grouped by
// batch and shift too, so different batches/shifts of the same item never
// get netted together — keeps the shift-wise consumption register accurate
// even when the same day's entries are edited more than once.
async function reverseProductionConsumption(tx, productionId) {
  const reference = `Production #${productionId}`;
  const grouped = await tx.inventoryTransaction.groupBy({
    by: ["itemId", "batchNo", "shift", "type"],
    where: { reference, type: { in: ["OUT", "ADJUSTMENT_IN"] } },
    _sum: { quantity: true }
  });

  const outstanding = new Map();
  for (const row of grouped) {
    const key = `${row.itemId}::${row.batchNo || ""}::${row.shift || ""}`;
    const sign = row.type === "OUT" ? 1 : -1;
    const qty = row._sum.quantity || 0;
    outstanding.set(key, {
      itemId: row.itemId,
      batchNo: row.batchNo,
      shift: row.shift,
      qty: (outstanding.get(key)?.qty || 0) + sign * qty
    });
  }

  const reversalRows = [...outstanding.values()]
    .filter(({ qty }) => qty > 0)
    .map(({ itemId, batchNo, shift, qty }) => ({
      type:      "ADJUSTMENT_IN",
      itemId,
      batchNo,
      shift,
      quantity:  qty,
      reference,
      remarks:   "Reversal: production consumption adjusted"
    }));

  if (reversalRows.length > 0) {
    await tx.inventoryTransaction.createMany({ data: reversalRows });
  }
}

// Keeps the finished-goods inventory ledger in sync with produced quantity:
// tops it up as more gets produced, and corrects it back down if a produced
// quantity is ever edited downward. Uses the same itemId as consumption so a
// finished good can later be picked as a raw material for another product.
async function syncFinishedGoodsInward(tx, productionId, itemId, producedQty, meta = {}) {
  const reference = `Production #${productionId}`;
  const normalizedItemId = String(itemId || "").trim();
  if (!normalizedItemId || !Number.isFinite(producedQty)) return;

  const grouped = await tx.inventoryTransaction.groupBy({
    by: ["type"],
    where: { reference, itemId: normalizedItemId, type: { in: ["IN", "ADJUSTMENT_OUT"] } },
    _sum: { quantity: true }
  });

  let alreadyInward = 0;
  for (const row of grouped) {
    const qty = row._sum.quantity || 0;
    alreadyInward += row.type === "IN" ? qty : -qty;
  }

  const delta = producedQty - alreadyInward;
  if (delta > 0) {
    await tx.inventoryTransaction.create({
      data: {
        type:     "IN",
        itemId:   normalizedItemId,
        quantity: delta,
        reference,
        remarks:  "Finished goods inward from production",
        uom:      meta.uom || null,
        grade:    meta.grade || null
      }
    });
  } else if (delta < 0) {
    await tx.inventoryTransaction.create({
      data: {
        type:     "ADJUSTMENT_OUT",
        itemId:   normalizedItemId,
        quantity: -delta,
        reference,
        remarks:  "Correction: produced quantity reduced",
        uom:      meta.uom || null,
        grade:    meta.grade || null
      }
    });
  }
}

export function buildProductionCreateData(order, payload = {}) {
  const assignedPersonnel = normalizeTrimmedInput(payload.assigned_personnel) || order.clientName || "Production Team";
  const parsedDeliveryDate = parseDateInput(payload.delivery_date);
  const deliveryDateValue = parsedDeliveryDate || new Date(order.deliveryDate || new Date());
  const productSpecs = normalizeTrimmedInput(payload.product_specs) || `${order.product} ${order.grade ? `(${order.grade})` : ""}`.trim();
  const capacity = normalizePositiveIntegerInput(payload.capacity, "Capacity") ?? normalizePositiveIntegerInput(order.quantity, "Order quantity") ?? 1;
  const particleSize = normalizeTrimmedInput(payload.particle_size) || "NA";
  const acmRpm = normalizePositiveIntegerInput(payload.acm_rpm, "ACM RPM") ?? 1000;
  const classifierRpm = normalizePositiveIntegerInput(payload.classifier_rpm, "Classifier RPM") ?? 1000;
  const blowerRpm = normalizePositiveIntegerInput(payload.blower_rpm, "Blower RPM") ?? 1000;
  const rawMaterials = normalizeTrimmedInput(payload.raw_materials) || null;
  const remarks = payload.remarks ?? `Auto-generated from order ${order.salesOrderNumber}`;

  return {
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
    state: payload.state || null
  };
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

  const batchNo = normalizeTrimmedInput(payload.batch_no);
  if (batchNo !== undefined) {
    updateData.batchNo = batchNo;
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

export async function createProduction(payload, actorUser, client = prisma) {
  const order = await client.order.findUnique({
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
      salesOrderNumber: true
    }
  });

  const { production } = await startProductionFromOrder(order, actorUser, payload, client);
  return production;
}

export async function startProductionFromOrder(order, actorUser, payload = {}, client = prisma) {
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

  const production = await client.production.create({
    data: {
      orderId: order.id,
      ...buildProductionCreateData(order, payload),
      status: "PENDING"
    },
    select: PRODUCTION_LIST_SELECT
  });

  const updatedOrder = await client.order.update({
    where: { id: order.id },
    data: { status: "IN_PRODUCTION" },
    select: ORDER_LIST_SELECT
  });

  await recordAuditEvent({
    action: "START_PRODUCTION",
    entityType: "Production",
    entityId: production.id,
    user: actorUser,
    newValue: production,
    note: `Started production for order #${order.id}`,
    tx: client
  });

  invalidateProductionReadCaches();
  return { production, order: updatedOrder };
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
    // Production queue priority: urgent jobs are pulled to the front, and
    // everything else runs FIFO (oldest order first) so nothing starves.
    orderBy: [
      { order: { isUrgent: "desc" } },
      { createdAt: "asc" },
      { id: "asc" }
    ]
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
      producedQuantity: true,
      productionStartedDate: true,
      order: {
        select: {
          id: true,
          product: true,
          grade: true,
          unit: true,
          quantity: true,
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
  // Each production row is now its own batch, so completing it should not
  // force its producedQuantity up to the order's full quantity — that's only
  // correct once every batch for the order is accounted for. Finished-goods
  // inventory inward now happens when this batch's QC sheet is saved with a
  // Pass result (see saveFinishedGoodsTestSheet), not at completion time.
  const finalProducedQty = production.producedQuantity || 0;

  await prisma.$transaction(async (tx) => {
    await tx.production.update({
      where: { id: productionId },
      data: {
        status: "COMPLETED",
        // Defensive fallback: if a batch was somehow completed without ever
        // being recorded as started (see updateProduction), still note a
        // started time so duration is never left unreported.
        productionStartedDate: production.productionStartedDate || completionDate,
        productionCompletionDate: completionDate,
        producedQuantity: finalProducedQty
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
      producedQuantity: true,
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
      productionStartedDate: true,
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

  // Handle produced quantity updates (partial production)
  if (payload.produced_quantity !== undefined) {
    const numeric = Number(payload.produced_quantity);
    if (!Number.isInteger(numeric) || numeric < 0) {
      const error = new Error("Produced quantity must be a non-negative integer.");
      error.statusCode = 400;
      throw error;
    }
    // Load order quantity to validate upper bound
    const order = await prisma.order.findUnique({
      where: { id: production.orderId },
      select: { quantity: true }
    });
    const maxQty = Number(order?.quantity || 0);
    if (numeric > maxQty) {
      const error = new Error(`Produced quantity cannot exceed order quantity (${maxQty}).`);
      error.statusCode = 400;
      throw error;
    }

    updateData.producedQuantity = numeric;

    if (numeric >= maxQty) {
      updateData.status = "COMPLETED";
      updateData.productionCompletionDate = new Date();
    } else if (numeric > 0) {
      updateData.status = "PARTIALLY_PRODUCED";
    }
  }

  // Auto-stamp the moment a batch first leaves PENDING, regardless of which
  // status it lands on (IN_PROGRESS, or straight to PARTIALLY_PRODUCED/
  // COMPLETED via a produced-quantity update) — otherwise Duration can never
  // be computed for batches that skip an explicit IN_PROGRESS step.
  const leavingPending = production.status === "PENDING" &&
    ["IN_PROGRESS", "PARTIALLY_PRODUCED", "COMPLETED"].includes(updateData.status) &&
    !production.productionStartedDate;
  if (leavingPending) {
    updateData.productionStartedDate = new Date();
  }

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

    // Deduct raw material inventory when production starts, and keep the
    // ledger in sync if the raw material list is corrected afterwards
    // (re-deducting from scratch avoids drift between edits).
    const alreadyActive = ["IN_PROGRESS", "PARTIALLY_PRODUCED", "HOLD", "COMPLETED"].includes(production.status);
    const rawMaterialsChanging = updateData.rawMaterials !== undefined && updateData.rawMaterials !== production.rawMaterials;

    if (leavingPending || (alreadyActive && rawMaterialsChanging)) {
      await reverseProductionConsumption(tx, productionId);
      const rawMaterialsStr = updateData.rawMaterials ?? production.rawMaterials;
      const txnData = buildConsumptionRows(rawMaterialsStr, productionId);
      if (txnData.length > 0) {
        await tx.inventoryTransaction.createMany({ data: txnData });
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

export async function getProductionById(productionId) {
  let production;
  try {
    production = await prisma.production.findUnique({
      where: { id: productionId },
      select: PRODUCTION_DETAIL_SELECT
    });
  } catch (err) {
    if (err?.code === "P2021") {
      production = await prisma.production.findUnique({
        where: { id: productionId },
        select: PRODUCTION_LIST_SELECT
      });
    } else {
      throw err;
    }
  }
  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }
  return production;
}

export async function saveFinishedGoodsTestSheet(productionId, payload, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      status: true,
      producedQuantity: true,
      orderId: true,
      order: { select: { product: true, unit: true, grade: true, status: true } }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!["COMPLETED", "PARTIALLY_PRODUCED"].includes(production.status)) {
    const error = new Error("Finished product test sheet can only be recorded once production has at least a partial produced quantity.");
    error.statusCode = 400;
    throw error;
  }

  const overallResult = payload.overall_result || "PENDING";
  const itemsData = payload.items.map((item) => ({
    srNo:          item.sr_no ?? null,
    sampleDate:    item.sample_date ? new Date(item.sample_date) : null,
    shift:         item.shift || null,
    samplingBy:    item.sampling_by || null,
    samplingTime:  item.sampling_time || null,
    blackParticle: item.black_particle || null,
    bulkDensity:   item.bulk_density || null,
    sieveResidue:  item.sieve_residue || null,
    analysisBy:    item.analysis_by || null,
    remarks:       item.remarks || null
  }));

  await prisma.$transaction(async (tx) => {
    await tx.finishedGoodsTestSheet.upsert({
      where:  { productionId },
      create: {
        productionId,
        productName:   payload.product_name || null,
        grade:         payload.grade || null,
        batchNo:       payload.batch_no || null,
        overallResult,
        approvedBy:    payload.approved_by || null,
        approvedAt:    overallResult !== "PENDING" ? new Date() : null,
        items: { create: itemsData }
      },
      update: {
        productName:   payload.product_name || null,
        grade:         payload.grade || null,
        batchNo:       payload.batch_no || null,
        overallResult,
        approvedBy:    payload.approved_by || null,
        approvedAt:    overallResult !== "PENDING" ? new Date() : null,
        items: { deleteMany: {}, create: itemsData }
      }
    });

    // Finished goods only enter the real-time inventory ledger once QC
    // passes for this batch — keeps dispatch's inventory check trustworthy.
    // Re-saving with a different result (e.g. a PASS -> FAIL correction)
    // adjusts the ledger via the same delta-based sync.
    await syncFinishedGoodsInward(tx, productionId, production.order.product, overallResult === "PASS" ? production.producedQuantity : 0, {
      uom: production.order.unit,
      grade: production.order.grade
    });

    // A QC pass is the moment finished goods actually become real,
    // dispatchable stock — move the order into READY_FOR_DISPATCH here
    // rather than relying on production's own status, which can reach
    // COMPLETED (via a produced-quantity update) without ever syncing the
    // order and leaving it invisible to the Packing/Dispatch queues.
    if (overallResult === "PASS" && production.order.status === "IN_PRODUCTION") {
      await tx.order.update({
        where: { id: production.orderId },
        data: { status: "READY_FOR_DISPATCH" }
      });
    }
  });

  await recordAuditEvent({
    action:     "SAVE_FINISHED_GOODS_TEST_SHEET",
    entityType: "Production",
    entityId:   productionId,
    user:       actorUser,
    newValue:   { overallResult }
  });

  invalidateProductionReadCaches();
  return getProductionById(productionId);
}

// Periodic in-process sampling log (by shift/lot/reactor), taken while
// production is running — distinct from the finished-goods test sheet
// recorded once at completion. Purely a record-keeping log: it does not
// gate production status or dispatch.
export async function saveInProcessTestSheet(productionId, payload, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  const itemsData = payload.items.map((item) => ({
    analysisDate:  item.analysis_date ? new Date(item.analysis_date) : null,
    shift:         item.shift || null,
    lotNo:         item.lot_no || null,
    reactorNo:     item.reactor_no || null,
    samplingBy:    item.sampling_by || null,
    samplingTime:  item.sampling_time || null,
    freeFattyAcid: item.free_fatty_acid || null,
    ash:           item.ash || null,
    moisture:      item.moisture || null,
    appearance:    item.appearance || null,
    meltingPoint:  item.melting_point || null,
    analysisBy:    item.analysis_by || null,
    ffaInformTime: item.ffa_inform_time || null,
    remarks:       item.remarks || null
  }));

  await prisma.$transaction(async (tx) => {
    await tx.inProcessTestSheet.upsert({
      where:  { productionId },
      create: {
        productionId,
        productName: payload.product_name || null,
        grade:       payload.grade || null,
        batchNo:     payload.batch_no || null,
        items: { create: itemsData }
      },
      update: {
        productName: payload.product_name || null,
        grade:       payload.grade || null,
        batchNo:     payload.batch_no || null,
        items: { deleteMany: {}, create: itemsData }
      }
    });
  });

  await recordAuditEvent({
    action:     "SAVE_IN_PROCESS_TEST_SHEET",
    entityType: "Production",
    entityId:   productionId,
    user:       actorUser,
    newValue:   { itemCount: itemsData.length }
  });

  invalidateProductionReadCaches();
  return getProductionById(productionId);
}

// Swaps a consumed raw-material/additive/catalyst batch for a different one:
// returns the original batch's quantity to inventory and deducts the same
// quantity from the substitute batch, atomically, with a permanent audit
// record (BatchSubstitution) linking both resulting ledger transactions.
export async function substituteProductionBatch(productionId, payload, actorUser) {
  const section = payload.section;
  if (!SUBSTITUTION_SECTIONS.includes(section)) {
    const error = new Error("Invalid section for batch substitution.");
    error.statusCode = 400;
    throw error;
  }

  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true, rawMaterials: true }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  const mfg = parseFullMfgBlob(production.rawMaterials);
  const rows = mfg[section];
  const rowIndex = Number(payload.row_index);
  const row = rows[rowIndex];

  if (!row) {
    const error = new Error("Raw material row not found.");
    error.statusCode = 404;
    throw error;
  }

  const originalItemId = String(row.name || "").trim();
  const originalBatchNo = String(row.batch_no || "").trim();
  const quantity = Math.round(Number(payload.quantity));

  // Optimistic concurrency: the row must still match what the client saw
  // when it decided to substitute it (it may have been edited since).
  if (
    originalItemId !== String(payload.original_item_id || "").trim() ||
    originalBatchNo !== String(payload.original_batch_no || "").trim() ||
    Math.round(Number(row.qty)) !== quantity
  ) {
    const error = new Error("This raw material row has changed since it was loaded. Reload and try again.");
    error.statusCode = 409;
    throw error;
  }

  if (!originalBatchNo) {
    const error = new Error("The selected row has no batch number to substitute.");
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    const error = new Error("Quantity must be a positive integer.");
    error.statusCode = 400;
    throw error;
  }

  const substituteItemId = String(payload.substitute_item_id || "").trim();
  const substituteBatchNo = String(payload.substitute_batch_no || "").trim();
  if (!substituteItemId || !substituteBatchNo) {
    const error = new Error("Substitute item and batch number are required.");
    error.statusCode = 400;
    throw error;
  }

  if (substituteItemId === originalItemId && substituteBatchNo === originalBatchNo) {
    const error = new Error("Substitute batch must be different from the original.");
    error.statusCode = 400;
    throw error;
  }

  // Prevent negative inventory: the substitute batch must actually carry enough stock.
  const availableQty = await getAvailableInventoryQty(substituteItemId, substituteBatchNo);
  if (availableQty < quantity) {
    const error = new Error(`Substitute batch "${substituteBatchNo}" only has ${availableQty} available, cannot deduct ${quantity}.`);
    error.statusCode = 409;
    throw error;
  }

  // Prevent duplicate substitution of the exact same original consumption.
  const duplicate = await prisma.batchSubstitution.findFirst({
    where: { productionId, section, originalItemId, originalBatchNo, quantity }
  });
  if (duplicate) {
    const error = new Error("This batch has already been substituted.");
    error.statusCode = 409;
    throw error;
  }

  const reference = `Production #${productionId}`;
  const substituteVendor = payload.substitute_vendor ? String(payload.substitute_vendor).trim() : null;
  const substituteGrade = payload.substitute_grade ? String(payload.substitute_grade).trim() : null;

  const substitution = await prisma.$transaction(async (tx) => {
    const reversalTxn = await tx.inventoryTransaction.create({
      data: {
        type:      "ADJUSTMENT_IN",
        itemId:    originalItemId,
        batchNo:   originalBatchNo,
        quantity,
        reference,
        remarks:   `Batch substitution reversal: ${originalBatchNo} replaced by ${substituteBatchNo}`
      }
    });

    const consumptionTxn = await tx.inventoryTransaction.create({
      data: {
        type:      "OUT",
        itemId:    substituteItemId,
        batchNo:   substituteBatchNo,
        quantity,
        reference,
        remarks:   `Batch substitution: replaces ${originalItemId} / ${originalBatchNo}`
      }
    });

    const updatedRows = rows.map((r, i) => (i === rowIndex
      ? { ...r, name: substituteItemId, batch_no: substituteBatchNo, vendor: substituteVendor ?? r.vendor, grade: substituteGrade ?? r.grade }
      : r));

    await tx.production.update({
      where: { id: productionId },
      data: { rawMaterials: JSON.stringify({ ...mfg, [section]: updatedRows }) }
    });

    const created = await tx.batchSubstitution.create({
      data: {
        productionId,
        section,
        originalItemId,
        originalBatchNo,
        originalVendor: row.vendor || null,
        originalGrade:  row.grade || null,
        quantity,
        substituteItemId,
        substituteBatchNo,
        substituteVendor,
        substituteGrade,
        reason: payload.reason ? String(payload.reason).trim() : null,
        reversalTransactionId:    reversalTxn.id,
        consumptionTransactionId: consumptionTxn.id,
        createdById: actorUser.id
      },
      select: BATCH_SUBSTITUTION_SELECT
    });

    await recordAuditEvent({
      tx,
      action:     "SUBSTITUTE_PRODUCTION_BATCH",
      entityType: "Production",
      entityId:   productionId,
      user:       actorUser,
      oldValue:   { itemId: originalItemId, batchNo: originalBatchNo, quantity },
      newValue:   { itemId: substituteItemId, batchNo: substituteBatchNo, quantity },
      note: `Substituted batch ${originalBatchNo} with ${substituteBatchNo} for ${quantity} of "${originalItemId}" on production #${productionId}`
    });

    return created;
  });

  invalidateProductionReadCaches();
  const updatedProduction = await getProductionById(productionId);
  return { production: updatedProduction, substitution };
}

export async function listBatchSubstitutions(productionId) {
  return prisma.batchSubstitution.findMany({
    where: { productionId },
    select: BATCH_SUBSTITUTION_SELECT,
    orderBy: { createdAt: "desc" }
  });
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
          product: true,
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
    await reverseProductionConsumption(tx, productionId);
    await syncFinishedGoodsInward(tx, productionId, production.order.product, 0);

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

    // An order can have multiple production batches — only reset it back to
    // CREATED if this was the last one. Otherwise leave the order's status
    // as-is, since other batches may still be actively in progress.
    const remainingBatches = await tx.production.count({
      where: { orderId: production.orderId }
    });
    if (remainingBatches === 0) {
      await tx.order.update({
        where: { id: production.orderId },
        data: { status: "CREATED" }
      });
    }
  });

  invalidateProductionReadCaches();
  return { id: productionId };
}
