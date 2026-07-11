import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";

const CREDIT_TYPES = new Set(["IN", "ADJUSTMENT_IN"]);
const DEBIT_TYPES = new Set(["OUT", "ADJUSTMENT_OUT"]);

// Real-time net stock for a single item, used by dispatch to decide what's
// actually available to ship regardless of which batch/production it came from.
// Pass batchNo to scope the same calculation down to one specific batch line
// (used by production batch substitution to check a substitute batch has
// enough stock, and that the original batch's stock nets out after reversal).
export async function getAvailableInventoryQty(itemId, batchNo) {
  const normalized = String(itemId || "").trim();
  if (!normalized) return 0;

  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["type"],
    where: {
      itemId: normalized,
      ...(batchNo !== undefined ? { batchNo: batchNo || null } : {})
    },
    _sum: { quantity: true }
  });

  let net = 0;
  for (const row of grouped) {
    const qty = row._sum.quantity || 0;
    if (CREDIT_TYPES.has(row.type)) net += qty;
    else if (DEBIT_TYPES.has(row.type)) net -= qty;
  }
  return net;
}

// Per-batch breakdown of net stock for one item — powers the "which batches
// are available" picker for production batch substitution.
export async function getBatchInventorySummary(itemId) {
  const normalized = String(itemId || "").trim();
  if (!normalized) return [];

  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["batchNo", "type"],
    where: { itemId: normalized },
    _sum: { quantity: true }
  });

  const batchMap = new Map();
  for (const row of grouped) {
    const batchNo = row.batchNo || "";
    if (!batchMap.has(batchNo)) batchMap.set(batchNo, 0);
    const qty = row._sum.quantity || 0;
    const sign = CREDIT_TYPES.has(row.type) ? 1 : DEBIT_TYPES.has(row.type) ? -1 : 0;
    batchMap.set(batchNo, batchMap.get(batchNo) + sign * qty);
  }

  return [...batchMap.entries()]
    .filter(([batchNo]) => batchNo)
    .map(([batchNo, netQty]) => ({ batchNo, netQty }))
    .sort((a, b) => a.batchNo.localeCompare(b.batchNo));
}

// Known vendor/grade/batch combinations actually received for one item, so
// production staff can pick a batch instead of retyping details that are
// already on file from the GRN it came in on.
export async function getItemBatchOptions(itemId) {
  const normalized = String(itemId || "").trim();
  if (!normalized) return [];

  const [grnItems, batchQtyRows] = await Promise.all([
    prisma.grnItem.findMany({
      where: { itemId: normalized, batchNo: { not: null } },
      select: {
        batchNo: true,
        grade: true,
        poItem: { select: { supplier: true } }
      },
      orderBy: { id: "desc" }
    }),
    getBatchInventorySummary(normalized)
  ]);

  const qtyByBatch = new Map(batchQtyRows.map((row) => [row.batchNo, row.netQty]));

  const seen = new Set();
  const options = [];
  for (const gi of grnItems) {
    const batchNo = gi.batchNo?.trim();
    if (!batchNo || seen.has(batchNo)) continue;
    seen.add(batchNo);
    options.push({
      batchNo,
      grade: gi.grade || "",
      vendor: gi.poItem?.supplier || "",
      availableQty: qtyByBatch.get(batchNo) ?? 0
    });
  }
  return options;
}

// Daily stock movement register (Opening Stock / Production(received) /
// Dispatch / Consume by shift / Closing Stock) per item+batch, computed
// entirely from the InventoryTransaction ledger for the given date.
export async function getStockRegister(dateStr) {
  const startOfDay = new Date(`${String(dateStr || "").trim()}T00:00:00.000Z`);
  if (Number.isNaN(startOfDay.getTime())) {
    const error = new Error("A valid date is required.");
    error.statusCode = 400;
    throw error;
  }
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const [openingGrouped, todayGrouped] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ["itemId", "batchNo", "type"],
      where: { createdAt: { lt: startOfDay }, batchNo: { not: null } },
      _sum: { quantity: true }
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["itemId", "batchNo", "type", "shift"],
      where: { createdAt: { gte: startOfDay, lt: endOfDay }, batchNo: { not: null } },
      _sum: { quantity: true }
    })
  ]);

  const rowsByKey = new Map();
  const keyOf = (itemId, batchNo) => `${itemId}::${batchNo}`;
  const getRow = (itemId, batchNo) => {
    const key = keyOf(itemId, batchNo);
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, {
        itemId, batchNo,
        openingStock: 0, production: 0, dispatch: 0,
        consumeAShift: 0, consumeBShift: 0, consumeCShift: 0
      });
    }
    return rowsByKey.get(key);
  };

  for (const row of openingGrouped) {
    const qty = row._sum.quantity || 0;
    const entry = getRow(row.itemId, row.batchNo);
    if (CREDIT_TYPES.has(row.type)) entry.openingStock += qty;
    else if (DEBIT_TYPES.has(row.type)) entry.openingStock -= qty;
  }

  for (const row of todayGrouped) {
    const qty = row._sum.quantity || 0;
    const entry = getRow(row.itemId, row.batchNo);
    const shift = row.shift;

    if (row.type === "IN") {
      entry.production += qty;
    } else if (row.type === "ADJUSTMENT_IN") {
      // Reversals carry the same shift as the consumption they're undoing,
      // so they net directly against that shift's consume total. Anything
      // without a shift (manual adjustments, batch-substitution returns)
      // is treated as a plain receipt.
      if (shift === "A") entry.consumeAShift -= qty;
      else if (shift === "B") entry.consumeBShift -= qty;
      else if (shift === "C") entry.consumeCShift -= qty;
      else entry.production += qty;
    } else if (row.type === "OUT") {
      if (shift === "A") entry.consumeAShift += qty;
      else if (shift === "B") entry.consumeBShift += qty;
      else if (shift === "C") entry.consumeCShift += qty;
      else entry.dispatch += qty;
    } else if (row.type === "ADJUSTMENT_OUT") {
      entry.dispatch += qty;
    }
  }

  const itemIds = [...new Set([...rowsByKey.values()].map((r) => r.itemId))];
  const grnItems = itemIds.length
    ? await prisma.grnItem.findMany({
        where: { itemId: { in: itemIds } },
        select: { itemId: true, grade: true },
        orderBy: { id: "desc" }
      })
    : [];
  const gradeByItemId = new Map();
  for (const gi of grnItems) {
    if (!gradeByItemId.has(gi.itemId)) gradeByItemId.set(gi.itemId, gi.grade || "");
  }

  return [...rowsByKey.values()]
    .map((entry) => {
      const consumeTotal = entry.consumeAShift + entry.consumeBShift + entry.consumeCShift;
      const closingStock = entry.openingStock + entry.production - entry.dispatch - consumeTotal;
      return {
        ...entry,
        grade: gradeByItemId.get(entry.itemId) || "",
        closingStock
      };
    })
    .filter((row) => row.openingStock !== 0 || row.production !== 0 || row.dispatch !== 0 ||
      row.consumeAShift !== 0 || row.consumeBShift !== 0 || row.consumeCShift !== 0 || row.closingStock !== 0)
    .sort((a, b) => a.itemId.localeCompare(b.itemId) || a.batchNo.localeCompare(b.batchNo));
}

export async function getRawMaterialInventory(query = {}) {
  const { search, category, uom, grade } = query;

  // Sum quantities per itemId/type at the DB level instead of loading every
  // transaction row into memory (the ledger only grows over time).
  const grouped = await prisma.inventoryTransaction.groupBy({
    by: ["itemId", "type"],
    _sum: { quantity: true }
  });

  const stockMap = new Map();
  for (const row of grouped) {
    if (!stockMap.has(row.itemId)) {
      stockMap.set(row.itemId, {
        itemId:            row.itemId,
        totalIn:           0,
        totalOut:          0,
        netQty:            0,
        warehouseLocation: "",
        lastReceivedAt:    null
      });
    }
    const entry = stockMap.get(row.itemId);
    const qty = row._sum.quantity || 0;
    if (CREDIT_TYPES.has(row.type)) {
      entry.totalIn += qty;
    } else if (DEBIT_TYPES.has(row.type)) {
      entry.totalOut += qty;
    }
    entry.netQty = entry.totalIn - entry.totalOut;
  }

  if (stockMap.size === 0) {
    return { items: [], summary: { totalItems: 0, totalQtyIn: 0, totalQtyOut: 0 } };
  }

  // Only true GRN receipts ("IN") count toward "last received" metadata —
  // manual adjustments/reversals aren't real deliveries.
  const receipts = await prisma.inventoryTransaction.findMany({
    where:   { type: "IN" },
    select:  { itemId: true, warehouseLocation: true, createdAt: true },
    orderBy: { createdAt: "desc" }
  });
  for (const receipt of receipts) {
    const entry = stockMap.get(receipt.itemId);
    if (entry && !entry.lastReceivedAt) {
      entry.lastReceivedAt    = receipt.createdAt;
      entry.warehouseLocation = receipt.warehouseLocation || "";
    }
  }

  // Latest metadata per itemId from GrnItem
  const itemIds = [...stockMap.keys()];
  const grnItems = await prisma.grnItem.findMany({
    where:   { itemId: { in: itemIds } },
    select:  { itemId: true, category: true, uom: true, grade: true, batchNo: true },
    orderBy: { id: "desc" }
  });

  const metaMap = new Map();
  for (const gi of grnItems) {
    if (!metaMap.has(gi.itemId)) {
      metaMap.set(gi.itemId, {
        category: gi.category || "",
        uom:      gi.uom      || "",
        grade:    gi.grade    || "",
        batchNo:  gi.batchNo  || ""
      });
    }
  }

  // Items that only ever moved through production/dispatch (finished goods,
  // never received via a GRN) still carry uom/grade on their own ledger rows.
  const unmetaItemIds = itemIds.filter((itemId) => !metaMap.has(itemId));
  if (unmetaItemIds.length > 0) {
    const fallbackRows = await prisma.inventoryTransaction.findMany({
      where:   { itemId: { in: unmetaItemIds }, OR: [{ uom: { not: null } }, { grade: { not: null } }] },
      select:  { itemId: true, uom: true, grade: true },
      orderBy: { id: "desc" }
    });
    for (const row of fallbackRows) {
      if (!metaMap.has(row.itemId)) {
        metaMap.set(row.itemId, { category: "", uom: row.uom || "", grade: row.grade || "", batchNo: "" });
      }
    }
  }

  let items = [...stockMap.values()].map((entry) => ({
    ...entry,
    ...(metaMap.get(entry.itemId) || { category: "", uom: "", grade: "", batchNo: "" })
  }));

  // Filter
  if (search) {
    const q = search.toLowerCase();
    items = items.filter(
      (item) =>
        item.itemId.toLowerCase().includes(q) ||
        (item.category || "").toLowerCase().includes(q) ||
        (item.grade    || "").toLowerCase().includes(q)
    );
  }
  if (category) {
    items = items.filter((item) => (item.category || "") === category);
  }
  if (uom) {
    items = items.filter((item) => (item.uom || "") === uom);
  }
  if (grade) {
    items = items.filter((item) => (item.grade || "") === grade);
  }

  // Sort: low stock first, then alphabetical
  items.sort((a, b) => a.netQty - b.netQty || a.itemId.localeCompare(b.itemId));

  const summary = {
    totalItems:  items.length,
    totalQtyIn:  items.reduce((s, i) => s + i.totalIn,  0),
    totalQtyOut: items.reduce((s, i) => s + i.totalOut, 0)
  };

  const { take, skip, page, limit } = buildPagination(query, { defaultLimit: 0, maxLimit: 200 });
  if (!take) {
    return { items, summary };
  }

  return {
    items: items.slice(skip, skip + take),
    summary,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / limit))
    }
  };
}

export async function listDistinctItemIds() {
  const grouped = await prisma.inventoryTransaction.groupBy({ by: ["itemId"] });
  return grouped
    .map((row) => row.itemId)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export async function createStockAdjustment(payload, actorUser) {
  const itemId = String(payload.item_id || "").trim();
  const reason = String(payload.reason || "").trim();
  const direction = payload.direction;
  const quantity = Number(payload.quantity);

  if (!itemId) {
    const error = new Error("Item ID is required.");
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    const error = new Error("Quantity must be a positive number.");
    error.statusCode = 400;
    throw error;
  }
  if (direction !== "IN" && direction !== "OUT") {
    const error = new Error("Direction must be IN or OUT.");
    error.statusCode = 400;
    throw error;
  }
  if (reason.length < 3) {
    const error = new Error("A reason is required for stock adjustments.");
    error.statusCode = 400;
    throw error;
  }

  const transaction = await prisma.inventoryTransaction.create({
    data: {
      type:      direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      itemId,
      quantity,
      reference: "Manual Adjustment",
      remarks:   reason
    }
  });

  await recordAuditEvent({
    action:     "INVENTORY_ADJUSTMENT",
    entityType: "InventoryTransaction",
    entityId:   transaction.id,
    user:       actorUser,
    newValue:   transaction,
    note:       `${direction === "IN" ? "Added" : "Removed"} ${quantity} of "${itemId}": ${reason}`
  });

  return transaction;
}

// Bulk opening-stock import (e.g. from an Excel stock take): each row sets
// the target on-hand quantity for an item/batch. Rather than inserting the
// target directly, we diff it against current net stock and record just the
// delta as an adjustment — so the ledger stays a true transaction history
// instead of an absolute snapshot, and existing IN/OUT history is preserved.
export async function importOpeningStock(rows, actorUser) {
  const importBatch = `IMPORT-${Date.now()}`;
  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const itemId = String(row.item_id || "").trim();
      if (!itemId) {
        throw new Error("Item ID is required.");
      }

      const targetQty = Number(row.quantity);
      if (!Number.isFinite(targetQty) || targetQty < 0) {
        throw new Error("Quantity must be a non-negative number.");
      }

      const batchNo = row.batch_no ? String(row.batch_no).trim() : undefined;
      const currentQty = await getAvailableInventoryQty(itemId, batchNo);
      const delta = Math.round((targetQty - currentQty) * 1e6) / 1e6;

      if (delta === 0) {
        skipped += 1;
        continue;
      }

      const transaction = await prisma.inventoryTransaction.create({
        data: {
          type:       delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          itemId,
          quantity:   Math.abs(delta),
          category:   row.category || null,
          uom:        row.uom || null,
          grade:      row.grade || null,
          batchNo:    batchNo || null,
          reference:  "Excel Import - Opening Stock",
          remarks:    `Stock take import: set to ${targetQty} (was ${currentQty})`,
          importBatch
        }
      });

      await recordAuditEvent({
        action:     "INVENTORY_OPENING_STOCK_IMPORT",
        entityType: "InventoryTransaction",
        entityId:   transaction.id,
        user:       actorUser,
        newValue:   transaction,
        note:       `Opening stock import set "${itemId}" to ${Math.round(targetQty)} (delta ${delta > 0 ? "+" : ""}${delta})`
      });

      imported += 1;
    } catch (error) {
      errors.push({ row: index + 1, message: error?.message || "Import failed" });
    }
  }

  return {
    importBatch,
    total: rows.length,
    imported,
    skipped,
    failed: errors.length,
    errors
  };
}
