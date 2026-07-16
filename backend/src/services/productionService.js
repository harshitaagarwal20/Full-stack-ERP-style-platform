import prisma from "../config/prisma.js";
import { buildPagination } from "../utils/pagination.js";
import { buildMonthRange, recentDaysWhere } from "../utils/dateFilters.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { ORDER_LIST_SELECT, PRODUCTION_LIST_SELECT, PRODUCTION_DETAIL_SELECT, BATCH_SUBSTITUTION_SELECT } from "../utils/selects.js";
import { formatBatchNumber } from "../utils/businessNumbers.js";
import { assertEntryDate } from "../utils/dateRules.js";
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
// The list is re-read constantly by the production screens. Every write path
// calls invalidateProductionReadCaches(), so a short TTL cannot serve stale data
// after a change made through the app — it only collapses the repeated reads in
// between. It was 0, which disabled the cache entirely and left the machinery
// around it doing nothing.
const PRODUCTION_CACHE_TTL_MS = 10 * 1000;
const MAX_PRODUCTION_STATUS_CHANGES = 2;
let hasStatusChangeCountColumnCache;
let hasProductRemarkColumnCache;

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

// Quantities are weights, not counts — 10.5 T is a legitimate order — so they
// take a decimal. RPMs and batch counts keep the integer check above.
function normalizePositiveNumberInput(value, fieldName) {
  if (value === undefined || value === null || value === "") return undefined;

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    const error = new Error(`${fieldName} must be a positive number.`);
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

function assertInProcessTestApproved(production) {
  if (production?.inProcessTestSheet?.overallResult === "PASS") return;

  const error = new Error("In-process test sheet must be approved before production can be completed.");
  error.statusCode = 400;
  throw error;
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
    // Raw material is consumed in kg and the ledger column is a decimal, so a
    // 6800.5 kg charge is booked as 6800.5, not 6801.
    quantity:  Number(item.qty),
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
  const capacity = normalizePositiveNumberInput(payload.capacity, "Capacity") ?? normalizePositiveNumberInput(order.quantity, "Order quantity") ?? 1;
  const particleSize = normalizeTrimmedInput(payload.particle_size) || "NA";
  const acmRpm = normalizePositiveIntegerInput(payload.acm_rpm, "ACM RPM") ?? 1000;
  const classifierRpm = normalizePositiveIntegerInput(payload.classifier_rpm, "Classifier RPM") ?? 1000;
  const blowerRpm = normalizePositiveIntegerInput(payload.blower_rpm, "Blower RPM") ?? 1000;
  const rawMaterials = normalizeTrimmedInput(payload.raw_materials) || null;
  const remarks = payload.remarks ?? `Auto-generated from order ${order.salesOrderNumber}`;
  const productRemark = normalizeNullableTrimmedInput(payload.product_remark);

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
    productRemark,
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

// productRemark ships ahead of its migration on some databases (the additive
// migration is applied separately), so treat it as optional: never select or
// write it unless the column is actually present, or the whole Production list
// query fails. Mirrors the statusChangeCount handling above.
async function hasProductionProductRemarkColumn() {
  if (typeof hasProductRemarkColumnCache === "boolean") {
    return hasProductRemarkColumnCache;
  }

  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'Production'
       AND COLUMN_NAME = 'productRemark'`
  );

  hasProductRemarkColumnCache = Number(rows?.[0]?.total || 0) > 0;
  return hasProductRemarkColumnCache;
}

// PRODUCTION_LIST_SELECT with productRemark added only when the column exists.
async function productionListSelect() {
  if (await hasProductionProductRemarkColumn()) {
    return { ...PRODUCTION_LIST_SELECT, productRemark: true };
  }
  return PRODUCTION_LIST_SELECT;
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

// The operation log rides inside the manufacturing blob, and saving it resends
// every row. Dates already stored on the sheet stay valid; only a row whose date
// is new has to clear the backdating floor.
function assertOperationLogDates(incomingBlob, existingBlob) {
  const saved = parseFullMfgBlob(existingBlob).batchLogs.map((row) => row?.date).filter(Boolean);
  for (const row of parseFullMfgBlob(incomingBlob).batchLogs) {
    assertEntryDate(row?.date, "Operation log date", { grandfathered: saved });
  }
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

  const capacity = normalizePositiveNumberInput(payload.capacity, "Capacity");
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
    assertOperationLogDates(rawMaterials, production.rawMaterials);
    updateData.rawMaterials = rawMaterials;
  }

  if (payload.remarks !== undefined) {
    updateData.remarks = normalizeNullableTrimmedInput(payload.remarks);
  }

  if (payload.product_remark !== undefined) {
    updateData.productRemark = normalizeNullableTrimmedInput(payload.product_remark);
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

// An order can be topped up with extra batches, but never planned beyond what
// it actually still needs. "Still needed" is the order quantity minus:
//
//   - what has genuinely been made: produced quantity on batches whose QC
//     passed. A batch that FAILED QC produced nothing sellable (no finished
//     goods ever entered inventory), so its quantity becomes available to plan
//     again — that is exactly the top-up case.
//   - what is already planned in a batch that can still produce (anything not
//     yet COMPLETED), so a batch in flight is not double-counted.
const OPEN_BATCH_STATUSES = ["PENDING", "IN_PROGRESS", "HOLD", "PARTIALLY_PRODUCED"];
const BATCH_ADDABLE_ORDER_STATUSES = ["CREATED", "IN_PRODUCTION", "READY_FOR_DISPATCH"];

// A batch can be re-planned only while it is still purely a plan: not started,
// nothing produced against it, and no QC or substitution history hanging off it.
// Once any of that exists, re-cutting the batch would orphan real work — so its
// quantity is locked and planning works around it.
function isBatchEditable(batch) {
  return (
    batch.status === "PENDING"
    && Number(batch.producedQuantity || 0) === 0
    && !batch.finishedGoodsTestSheet
    && !batch.inProcessTestSheet
    && (batch.batchSubstitutions?.length ?? 0) === 0
  );
}

export async function getOrderBatchPlan(orderId, client = prisma) {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      quantity: true,
      deliveryDate: true,
      salesOrderNumber: true,
      productions: {
        select: {
          id: true,
          status: true,
          capacity: true,
          producedQuantity: true,
          batchNo: true,
          deliveryDate: true,
          finishedGoodsTestSheet: { select: { id: true, overallResult: true } },
          inProcessTestSheet: { select: { id: true } },
          batchSubstitutions: { select: { id: true } }
        },
        orderBy: { id: "asc" }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  let qcPassedQty = 0;
  let openPlannedQty = 0;
  // Quantity already committed to batches that can no longer be re-planned.
  let lockedQty = 0;

  const batches = order.productions.map((batch) => {
    if (batch.finishedGoodsTestSheet?.overallResult === "PASS") {
      qcPassedQty += Number(batch.producedQuantity || 0);
    }
    if (OPEN_BATCH_STATUSES.includes(batch.status)) {
      openPlannedQty += Number(batch.capacity || 0);
    }

    const editable = isBatchEditable(batch);
    if (!editable) {
      lockedQty += Number(batch.capacity || 0);
    }

    return {
      id: batch.id,
      status: batch.status,
      capacity: batch.capacity,
      producedQuantity: batch.producedQuantity,
      batchNo: batch.batchNo,
      deliveryDate: batch.deliveryDate,
      editable
    };
  });

  const remaining = Math.max(Number(order.quantity) - qcPassedQty - openPlannedQty, 0);
  // What a re-plan is free to redistribute: the order quantity minus everything
  // locked into batches that have already started.
  const plannableQty = Math.max(Number(order.quantity) - lockedQty, 0);
  const canAddBatch = BATCH_ADDABLE_ORDER_STATUSES.includes(order.status) && remaining > 0;
  const canPlan = BATCH_ADDABLE_ORDER_STATUSES.includes(order.status) && plannableQty > 0;

  return {
    orderId: order.id,
    salesOrderNumber: order.salesOrderNumber,
    orderStatus: order.status,
    orderQuantity: order.quantity,
    orderDeliveryDate: order.deliveryDate,
    qcPassedQty,
    openPlannedQty,
    remaining,
    lockedQty,
    plannableQty,
    canAddBatch,
    canPlan,
    batchCount: order.productions.length,
    batches
  };
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

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const plan = await getOrderBatchPlan(order.id, client);

  if (!BATCH_ADDABLE_ORDER_STATUSES.includes(order.status)) {
    const error = new Error(`Cannot add a batch to an order that is ${order.status.replace(/_/g, " ").toLowerCase()}.`);
    error.statusCode = 400;
    throw error;
  }

  if (plan.remaining <= 0) {
    const error = new Error(
      `Order ${order.salesOrderNumber} is fully planned (${plan.qcPassedQty} made, ${plan.openPlannedQty} in open batches, of ${order.quantity}). ` +
      "Reduce an existing batch's capacity before adding another."
    );
    error.statusCode = 400;
    throw error;
  }

  const requested = payload.capacity === undefined || payload.capacity === null
    ? plan.remaining
    : Number(payload.capacity);

  if (!Number.isFinite(requested) || requested <= 0) {
    const error = new Error("Batch capacity must be a positive number.");
    error.statusCode = 400;
    throw error;
  }

  if (requested > plan.remaining) {
    const error = new Error(`Batch capacity ${requested} exceeds the ${plan.remaining} still to be planned on this order.`);
    error.statusCode = 400;
    throw error;
  }

  const { production } = await startProductionFromOrder(
    order,
    actorUser,
    { ...payload, capacity: requested },
    client,
    { allowTopUp: true }
  );
  return production;
}

export async function startProductionFromOrder(order, actorUser, payload = {}, client = prisma, options = {}) {
  if (!order) {
    const error = new Error("Cannot start production without valid order.");
    error.statusCode = 400;
    throw error;
  }

  // A top-up batch may also be added to an order that already reached
  // READY_FOR_DISPATCH but came up short (e.g. a batch failed QC). Adding one
  // pulls the order back into production below, since it is no longer complete.
  const allowed = options.allowTopUp
    ? ["CREATED", "IN_PRODUCTION", "READY_FOR_DISPATCH"]
    : ["CREATED", "IN_PRODUCTION"];

  if (!allowed.includes(order.status)) {
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

  const createData = { orderId: order.id, ...buildProductionCreateData(order, payload), status: "PENDING" };
  if ("productRemark" in createData && !(await hasProductionProductRemarkColumn())) {
    delete createData.productRemark;
  }
  const listSelect = await productionListSelect();
  const created = await client.production.create({
    data: createData,
    select: listSelect
  });

  // The batch number is derived from the row's own id, so it can only be stamped
  // once the row exists.
  const production = await client.production.update({
    where: { id: created.id },
    data: { batchNo: formatBatchNumber(created.id) },
    select: listSelect
  });

  const updatedOrder = await client.order.update({
    where: { id: order.id },
    data: { status: "IN_PRODUCTION" },
    select: ORDER_LIST_SELECT
  });



  invalidateProductionReadCaches();
  return { production, order: updatedOrder };
}

// Splitting a job into more batches than this is almost certainly a typo in the
// batch size (e.g. entering 1 instead of 1000), and each batch is a real row
// with its own batch card — so refuse rather than create hundreds of them.
const MAX_SPLIT_BATCHES = 100;

// Divide `total` into `count` whole-unit batches that sum back to exactly
// `total`. The remainder is spread one unit at a time across the leading
// batches rather than dumped on the last one, which keeps batch sizes within
// one unit of each other (7 into 3 gives 3,2,2 — not 2,2,3).
export function splitQuantityEvenly(total, count) {
  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

// Schedule batches backwards from the order's expected timeline: the final
// batch lands exactly on the due date and the rest are spread evenly between
// now and then, so batch 1 is due soonest. The production queue then sorts
// each batch on its own date (see listProductionOrders).
//
// If the order is already due (or overdue), there is no window to spread over —
// every batch simply carries the due date and the queue falls back to FIFO.
export function buildBatchSchedule(dueDate, count, now = new Date()) {
  const due = new Date(dueDate);
  const start = now.getTime();
  const end = due.getTime();

  if (!Number.isFinite(end) || end <= start) {
    return Array.from({ length: count }, () => due);
  }

  const step = (end - start) / count;
  return Array.from({ length: count }, (_, index) => new Date(start + step * (index + 1)));
}

// The material quantities on the batch card were planned for the whole job, so
// after a split each batch needs its proportional share. Equipment and process
// parameters are per-batch settings, not quantities, so they ride along
// unchanged.
function scaleMfgBlobForBatch(rawMaterialsStr, ratio) {
  if (!rawMaterialsStr) return null;

  const mfg = parseFullMfgBlob(rawMaterialsStr);
  const scaleRows = (rows) =>
    rows.map((row) => {
      const qty = Number(row.qty);
      if (!Number.isFinite(qty) || qty <= 0) return row;
      // Scaling a recipe to a split batch rarely lands on a whole kg; keep three
      // decimals rather than rounding each line and drifting off the total.
      return { ...row, qty: Math.round(qty * ratio * 1000) / 1000 };
    });

  return JSON.stringify({
    ...mfg,
    rm: scaleRows(mfg.rm),
    additives: scaleRows(mfg.additives),
    catalysts: scaleRows(mfg.catalysts)
  });
}

export async function splitProductionIntoBatches(productionId, payload, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      status: true,
      capacity: true,
      producedQuantity: true,
      assignedPersonnel: true,
      deliveryDate: true,
      productSpecs: true,
      particleSize: true,
      acmRpm: true,
      classifierRpm: true,
      blowerRpm: true,
      rawMaterials: true,
      remarks: true,
      state: true,
      orderId: true,
      order: { select: { id: true, deliveryDate: true, salesOrderNumber: true } },
      finishedGoodsTestSheet: { select: { id: true } },
      inProcessTestSheet: { select: { id: true } },
      batchSubstitutions: { select: { id: true } }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  // A job that has started has already deducted raw materials against its own
  // reference, may carry QC sheets and substitutions, and may have produced
  // stock. Re-cutting it into different batches would orphan all of that, so a
  // split is only ever allowed before work begins.
  if (production.status !== "PENDING") {
    const error = new Error("Only a batch that has not started yet can be split.");
    error.statusCode = 400;
    throw error;
  }

  if (production.producedQuantity > 0) {
    const error = new Error("Cannot split a batch that already has a produced quantity.");
    error.statusCode = 400;
    throw error;
  }

  if (production.finishedGoodsTestSheet || production.inProcessTestSheet || production.batchSubstitutions.length > 0) {
    const error = new Error("Cannot split a batch that already has test sheets or batch substitutions recorded.");
    error.statusCode = 400;
    throw error;
  }

  const capacity = Number(production.capacity);
  if (!Number.isInteger(capacity) || capacity < 2) {
    const error = new Error("This batch is too small to split.");
    error.statusCode = 400;
    throw error;
  }

  const batchCount = payload.batch_count !== undefined && payload.batch_count !== null
    ? Number(payload.batch_count)
    : Math.ceil(capacity / Number(payload.batch_size));

  if (batchCount < 2) {
    const error = new Error("That batch size covers the whole job — nothing to split.");
    error.statusCode = 400;
    throw error;
  }

  if (batchCount > capacity) {
    const error = new Error(`Cannot split ${capacity} into ${batchCount} batches — each batch must be at least 1 unit.`);
    error.statusCode = 400;
    throw error;
  }

  if (batchCount > MAX_SPLIT_BATCHES) {
    const error = new Error(`Cannot split into more than ${MAX_SPLIT_BATCHES} batches (asked for ${batchCount}). Check the batch size.`);
    error.statusCode = 400;
    throw error;
  }

  const quantities = splitQuantityEvenly(capacity, batchCount);
  // The order's expected timeline is the commitment to the customer, so it
  // anchors the schedule. Fall back to the batch's own date if the order
  // somehow has none.
  const dueDate = production.order?.deliveryDate || production.deliveryDate;
  const schedule = buildBatchSchedule(dueDate, batchCount);

  const batches = await prisma.$transaction(async (tx) => {
    // Batch 1 reuses the existing row, so anything already linked to this
    // production id (and the planner's batch-card work) survives the split.
    const first = await tx.production.update({
      where: { id: productionId },
      data: {
        capacity: quantities[0],
        deliveryDate: schedule[0],
        rawMaterials: scaleMfgBlobForBatch(production.rawMaterials, quantities[0] / capacity)
      },
      select: PRODUCTION_LIST_SELECT
    });

    const created = [first];

    for (let index = 1; index < batchCount; index += 1) {
      const batch = await tx.production.create({
        data: {
          orderId: production.orderId,
          status: "PENDING",
          producedQuantity: 0,
          capacity: quantities[index],
          deliveryDate: schedule[index],
          rawMaterials: scaleMfgBlobForBatch(production.rawMaterials, quantities[index] / capacity),
          assignedPersonnel: production.assignedPersonnel,
          productSpecs: production.productSpecs,
          particleSize: production.particleSize,
          acmRpm: production.acmRpm,
          classifierRpm: production.classifierRpm,
          blowerRpm: production.blowerRpm,
          remarks: production.remarks,
          state: production.state
        },
        select: PRODUCTION_LIST_SELECT
      });
      created.push(batch);
    }

    // Every batch carries its own auto-generated number, including the original
    // row being split — it is now just the first batch of the set.
    const numbered = [];
    for (const batch of created) {
      numbered.push(
        await tx.production.update({
          where: { id: batch.id },
          data: { batchNo: formatBatchNumber(batch.id) },
          select: PRODUCTION_LIST_SELECT
        })
      );
    }

    return numbered;
  });

  invalidateProductionReadCaches();
  return batches;
}

// One action behind the "Plan Batches" screen: make the order's batches match a
// requested batch size. It replaces the old split/add-batch pair — dividing one
// big batch and filling in an under-planned order are the same operation seen
// from two ends, so the planner states the batch size they want and this works
// out whether that means resizing, creating or dropping rows.
//
// Batches that have already started are untouchable (see isBatchEditable): their
// quantity is subtracted from the order first, and only the rest is re-planned.
export async function planOrderBatches(orderId, payload, actorUser) {
  const batchSize = Number(payload.batch_size);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      quantity: true,
      salesOrderNumber: true,
      deliveryDate: true,
      product: true,
      grade: true,
      clientName: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      productions: {
        select: {
          id: true,
          status: true,
          capacity: true,
          producedQuantity: true,
          deliveryDate: true,
          assignedPersonnel: true,
          productSpecs: true,
          particleSize: true,
          acmRpm: true,
          classifierRpm: true,
          blowerRpm: true,
          rawMaterials: true,
          remarks: true,
          state: true,
          finishedGoodsTestSheet: { select: { id: true } },
          inProcessTestSheet: { select: { id: true } },
          batchSubstitutions: { select: { id: true } }
        },
        orderBy: { id: "asc" }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!BATCH_ADDABLE_ORDER_STATUSES.includes(order.status)) {
    const error = new Error(`Cannot plan batches for an order that is ${order.status.replace(/_/g, " ").toLowerCase()}.`);
    error.statusCode = 400;
    throw error;
  }

  const editable = order.productions.filter(isBatchEditable);
  const lockedQty = order.productions
    .filter((batch) => !isBatchEditable(batch))
    .reduce((sum, batch) => sum + Number(batch.capacity || 0), 0);

  const plannableQty = Math.max(Number(order.quantity) - lockedQty, 0);

  if (plannableQty <= 0) {
    const error = new Error(
      `Order ${order.salesOrderNumber} has no quantity left to plan — all ${order.quantity} is committed to batches that have already started.`
    );
    error.statusCode = 400;
    throw error;
  }

  const batchCount = Math.max(1, Math.ceil(plannableQty / batchSize));

  if (batchCount > MAX_SPLIT_BATCHES) {
    const error = new Error(
      `That batch size would create ${batchCount} batches (max ${MAX_SPLIT_BATCHES}). Check the batch size.`
    );
    error.statusCode = 400;
    throw error;
  }

  const quantities = splitQuantityEvenly(plannableQty, batchCount);
  const schedule = buildBatchSchedule(order.deliveryDate, batchCount);

  // New rows copy their process settings from an existing batch so the planner's
  // batch-card work carries over; if every batch is locked (or there are none),
  // fall back to deriving a fresh one from the order.
  const template = editable[0] || order.productions[0] || null;

  const batches = await prisma.$transaction(async (tx) => {
    const result = [];

    for (let index = 0; index < batchCount; index += 1) {
      const existing = editable[index];
      const capacity = quantities[index];

      if (existing) {
        // Reuse the row, so anything already linked to this production id
        // survives, and rescale its material quantities to the new size.
        const ratio = Number(existing.capacity) > 0 ? capacity / Number(existing.capacity) : 1;
        result.push(
          await tx.production.update({
            where: { id: existing.id },
            data: {
              capacity,
              deliveryDate: schedule[index],
              rawMaterials: scaleMfgBlobForBatch(existing.rawMaterials, ratio),
              batchNo: formatBatchNumber(existing.id)
            },
            select: PRODUCTION_LIST_SELECT
          })
        );
        continue;
      }

      const created = await tx.production.create({
        data: {
          orderId: order.id,
          status: "PENDING",
          producedQuantity: 0,
          capacity,
          deliveryDate: schedule[index],
          ...(template
            ? {
              rawMaterials: scaleMfgBlobForBatch(
                template.rawMaterials,
                Number(template.capacity) > 0 ? capacity / Number(template.capacity) : 1
              ),
              assignedPersonnel: template.assignedPersonnel,
              productSpecs: template.productSpecs,
              particleSize: template.particleSize,
              acmRpm: template.acmRpm,
              classifierRpm: template.classifierRpm,
              blowerRpm: template.blowerRpm,
              remarks: template.remarks,
              state: template.state
            }
            : buildProductionCreateData(order, { capacity, delivery_date: schedule[index] }))
        },
        select: PRODUCTION_LIST_SELECT
      });

      result.push(
        await tx.production.update({
          where: { id: created.id },
          data: { batchNo: formatBatchNumber(created.id) },
          select: PRODUCTION_LIST_SELECT
        })
      );
    }

    // Any editable batch the new plan does not need is surplus. It is PENDING
    // with no produced quantity, QC or substitutions, so deleting it discards
    // nothing that was ever worked on.
    const surplus = editable.slice(batchCount);
    if (surplus.length > 0) {
      await tx.production.deleteMany({ where: { id: { in: surplus.map((batch) => batch.id) } } });
    }

    return result;
  });

  invalidateProductionReadCaches();
  return { orderId: order.id, plannableQty, lockedQty, batchCount, batches };
}

export async function listProductionOrders(filters = {}) {
  const { q, status, company, date, month, recent_days: recentDays } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 20, maxLimit: 100 });
  const normalizedCompany = String(company || "").trim();
  const normalizedDate = String(date || "").trim();
  const dateFrom = normalizedDate ? new Date(`${normalizedDate}T00:00:00.000Z`) : null;
  const dateTo = normalizedDate ? new Date(`${normalizedDate}T23:59:59.999Z`) : null;

  const where = {
    ...(status ? { status } : {}),
    // Mobile sends recent_days=45; desktop omits it and sees full history.
    ...recentDaysWhere("createdAt", recentDays),
    ...(normalizedCompany ? { order: { clientName: { contains: normalizedCompany } } } : {}),
    ...(normalizedDate && dateFrom && dateTo ? { deliveryDate: { gte: dateFrom, lte: dateTo } } : {}),
    // Month = when the batch was created. AND-wrapped so it can't clobber the
    // search box's OR below.
    ...(buildMonthRange(month) ? { AND: [{ createdAt: buildMonthRange(month) }] } : {}),
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

  // Production queue priority, in order:
  //   1. Urgent jobs are pulled to the front.
  //   2. Then the earliest expected timeline (the order's committed delivery
  //      date) — the job whose promise to the customer comes due soonest is
  //      the one the floor should run next.
  //   3. Then FIFO (oldest batch first) so jobs sharing a delivery date —
  //      which is common — still run in the order they were raised and
  //      nothing starves.
  const ACTIVE_ORDER_BY = [
    { order: { isUrgent: "desc" } },
    { order: { deliveryDate: "asc" } },
    { createdAt: "asc" },
    { id: "asc" }
  ];

  // Finished jobs are not work any more, so they sink below everything still
  // open no matter how urgent or overdue they once were — the floor should only
  // ever read down from the top. Newest completion first among themselves.
  const DONE_ORDER_BY = [{ createdAt: "desc" }, { id: "desc" }];

  // The list is one page of [everything open, then everything completed], so it
  // is queried as two segments and sliced across the boundary. A status filter
  // collapses it to whichever segment that status belongs to.
  const completedFilter = status === "COMPLETED";
  const activeWhere = completedFilter ? null : { ...where, status: status || { not: "COMPLETED" } };
  const completedWhere = !status || completedFilter ? { ...where, status: "COMPLETED" } : null;

  const countSegment = (segmentWhere) =>
    (segmentWhere ? prisma.production.count({ where: segmentWhere }) : Promise.resolve(0));

  const listSelect = await productionListSelect();
  const fetchSegment = (segmentWhere, orderBy, segmentSkip, segmentTake) => {
    if (!segmentWhere || segmentTake <= 0) return Promise.resolve([]);
    return prisma.production.findMany({
      where: segmentWhere,
      select: listSelect,
      orderBy,
      skip: segmentSkip,
      take: segmentTake
    });
  };

  const cacheKey = buildCacheKey(PRODUCTION_CACHE_PREFIX, {
    q: q || null,
    status: status || null,
    company: normalizedCompany || null,
    date: normalizedDate || null,
    // Must be part of the key, or a cached response would ignore the month.
    month: String(month || "") || null,
    recentDays: String(recentDays || "") || null,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, PRODUCTION_CACHE_TTL_MS, async () => {
    const [activeTotal, completedTotal] = await Promise.all([
      countSegment(activeWhere),
      countSegment(completedWhere)
    ]);

    if (take > 0) {
      // Rows 0..activeTotal-1 of the combined list are the open jobs; the
      // completed ones continue the numbering from there. A page can straddle
      // the boundary and draw from both.
      const activeItems = await fetchSegment(activeWhere, ACTIVE_ORDER_BY, skip, Math.max(0, Math.min(take, activeTotal - skip)));
      const completedItems = await fetchSegment(
        completedWhere,
        DONE_ORDER_BY,
        Math.max(0, skip - activeTotal),
        take - activeItems.length
      );

      const total = activeTotal + completedTotal;
      return {
        items: [...activeItems, ...completedItems],
        pagination: {
          page,
          limit: take,
          total,
          totalPages: Math.max(1, Math.ceil(total / take))
        }
      };
    }

    const [activeItems, completedItems] = await Promise.all([
      activeWhere
        ? prisma.production.findMany({ where: activeWhere, select: listSelect, orderBy: ACTIVE_ORDER_BY })
        : Promise.resolve([]),
      completedWhere
        ? prisma.production.findMany({ where: completedWhere, select: listSelect, orderBy: DONE_ORDER_BY })
        : Promise.resolve([])
    ]);

    return [...activeItems, ...completedItems];
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
      inProcessTestSheet: {
        select: {
          overallResult: true
        }
      },
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

  assertInProcessTestApproved(production);

  assertEntryDate(payload.completion_date, "Completion date");

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
      productionCompletionDate: true,
      inProcessTestSheet: {
        select: {
          overallResult: true
        }
      }
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

  // Drop productRemark on databases that have not run its migration yet, so the
  // save still succeeds (the value is simply not persisted until the column exists).
  if ("productRemark" in updateData && !(await hasProductionProductRemarkColumn())) {
    delete updateData.productRemark;
  }

  // Handle produced quantity updates (partial production)
  if (payload.produced_quantity !== undefined) {
    const numeric = Number(payload.produced_quantity);
    if (!Number.isFinite(numeric) || numeric < 0) {
      const error = new Error("Produced quantity must be a non-negative number.");
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
      assertInProcessTestApproved(production);
      updateData.status = "COMPLETED";
      updateData.productionCompletionDate = new Date();
    } else if (numeric > 0) {
      // A part-made batch has still finished a run of work, and QC can already
      // test it — so stamp the completion date here too, or Duration would stay
      // blank on every partial batch. Re-stamped on each partial update, so it
      // tracks the most recent run rather than the first one.
      updateData.status = "PARTIALLY_PRODUCED";
      updateData.productionCompletionDate = new Date();
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

  const listSelect = await productionListSelect();
  const updatedProduction = await prisma.$transaction(async (tx) => {
    const updated = await tx.production.update({
      where: { id: productionId },
      data: updateData,
      select: listSelect
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
    const alreadyActive = ["IN_PROGRESS", "PARTIALLY_PRODUCED", "HOLD", "REWORK", "COMPLETED"].includes(production.status);
    const rawMaterialsChanging = updateData.rawMaterials !== undefined && updateData.rawMaterials !== production.rawMaterials;

    if (leavingPending || (alreadyActive && rawMaterialsChanging)) {
      await reverseProductionConsumption(tx, productionId);
      const rawMaterialsStr = updateData.rawMaterials ?? production.rawMaterials;
      const txnData = buildConsumptionRows(rawMaterialsStr, productionId);
      if (txnData.length > 0) {
        await tx.inventoryTransaction.createMany({ data: txnData });
      }
    }



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
      order: { select: { product: true, unit: true, grade: true, status: true } },
      finishedGoodsTestSheet: { select: { items: { select: { sampleDate: true } } } }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  // REWORK is allowed so a failed batch can be re-tested after production has
  // reworked it, without first having to fake a status change.
  if (!["COMPLETED", "PARTIALLY_PRODUCED", "REWORK"].includes(production.status)) {
    const error = new Error("Finished product test sheet can only be recorded once production has at least a partial produced quantity.");
    error.statusCode = 400;
    throw error;
  }

  const savedSampleDates = (production.finishedGoodsTestSheet?.items || []).map((item) => item.sampleDate);
  for (const item of payload.items) {
    assertEntryDate(item.sample_date, "Sample date", { grandfathered: savedSampleDates });
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
    approvedBy:    item.approved_by || null,
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

    // A FAIL is what opens the rework loop: the batch produced nothing sellable,
    // so it parks in REWORK until production works it again. A later PASS on the
    // same sheet closes the loop and hands the batch back as COMPLETED.
    if (overallResult === "FAIL" && production.status !== "REWORK") {
      await tx.production.update({
        where: { id: productionId },
        data: { status: "REWORK" }
      });
    }

    if (overallResult === "PASS" && production.status === "REWORK") {
      await tx.production.update({
        where: { id: productionId },
        data: { status: "COMPLETED" }
      });
    }
  });



  invalidateProductionReadCaches();
  return getProductionById(productionId);
}

// Closes the rework loop from the production side: a batch QC rejected into
// REWORK goes back onto the floor. Deliberately not routed through
// updateProduction() — rework is not one of the two discretionary status changes
// an operator is budgeted, and it must stay available however many times QC
// rejects the batch.
export async function resumeReworkBatch(productionId, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: { id: true, status: true }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  if (production.status !== "REWORK") {
    const error = new Error("Only a batch rejected into rework can be resumed.");
    error.statusCode = 400;
    throw error;
  }

  await prisma.production.update({
    where: { id: productionId },
    data: { status: "IN_PROGRESS" }
  });

  invalidateProductionReadCaches();
  return getProductionById(productionId);
}

// Periodic in-process sampling log (by shift/lot/reactor), taken while
// production is running — distinct from the finished-goods test sheet
// recorded once at completion.
//
// This is the "quality check in between project" gate on the approved flow: the
// sheet carries its own PASS/FAIL, and a FAIL sends the batch to REWORK before
// it ever reaches packing. Leaving the result PENDING keeps the sheet what it
// always was — a running log that gates nothing.
export async function saveInProcessTestSheet(productionId, payload, actorUser) {
  const production = await prisma.production.findUnique({
    where: { id: productionId },
    select: {
      id: true,
      status: true,
      inProcessTestSheet: { select: { items: { select: { analysisDate: true } } } }
    }
  });

  if (!production) {
    const error = new Error("Production record not found.");
    error.statusCode = 404;
    throw error;
  }

  const savedAnalysisDates = (production.inProcessTestSheet?.items || []).map((item) => item.analysisDate);
  for (const item of payload.items) {
    assertEntryDate(item.analysis_date, "Date of analysis", { grandfathered: savedAnalysisDates });
  }

  const overallResult = payload.overall_result || "PENDING";

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

    // Same loop as the finished-goods gate: a failed in-process check parks the
    // batch in REWORK, so it cannot be produced onward or packed until
    // production works it again.
    if (overallResult === "FAIL" && production.status !== "REWORK") {
      await tx.production.update({
        where: { id: productionId },
        data: { status: "REWORK" }
      });
    }
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
  const quantity = Number(payload.quantity);

  // Optimistic concurrency: the row must still match what the client saw
  // when it decided to substitute it (it may have been edited since).
  if (
    originalItemId !== String(payload.original_item_id || "").trim() ||
    originalBatchNo !== String(payload.original_batch_no || "").trim() ||
    Number(row.qty) !== quantity
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

  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Quantity must be a positive number.");
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

  const reference = `Production #${productionId}`;
  const substituteVendor = payload.substitute_vendor ? String(payload.substitute_vendor).trim() : null;
  const substituteGrade = payload.substitute_grade ? String(payload.substitute_grade).trim() : null;

  const substitution = await prisma.$transaction(async (tx) => {
    // Both gates run inside the transaction that writes the ledger rows:
    // checking stock (or for a duplicate) beforehand lets two concurrent
    // substitutions of the same row each pass and double-deduct the
    // substitute batch.
    const availableQty = await getAvailableInventoryQty(substituteItemId, substituteBatchNo, tx);
    if (availableQty < quantity) {
      const error = new Error(`Substitute batch "${substituteBatchNo}" only has ${availableQty} available, cannot deduct ${quantity}.`);
      error.statusCode = 409;
      throw error;
    }

    // Prevent duplicate substitution of the exact same original consumption.
    const duplicate = await tx.batchSubstitution.findFirst({
      where: { productionId, section, originalItemId, originalBatchNo, quantity }
    });
    if (duplicate) {
      const error = new Error("This batch has already been substituted.");
      error.statusCode = 409;
      throw error;
    }

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
