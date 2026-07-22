import prisma from "../config/prisma.js";
import { buildPagination } from "../utils/pagination.js";

const CREDIT_TYPES = new Set(["IN", "ADJUSTMENT_IN"]);
const DEBIT_TYPES = new Set(["OUT", "ADJUSTMENT_OUT"]);

export const RAW_MATERIAL = "RAW_MATERIAL";
export const PACKING_MATERIAL = "PACKING_MATERIAL";
export const FINISHED_GOODS = "FINISHED_GOODS";

// Categories in the data are whatever was typed when the item was purchased —
// "Raw Material", "Additive", "Catalyst", "Packing Material" — not the codes
// the newer screens use. Fold them onto the three buckets the inventory
// screens are split by, so filtering works on real historical data and not
// just on rows created since the codes were introduced.
//
// Additives and catalysts are production inputs bought on a PO exactly like
// raw materials (they even share the same production wizard steps), so they
// belong on the Raw Materials screen rather than in a bucket of their own.
// Anything with no category at all is finished goods: produced stock never
// arrives on a GRN, so it is the only thing that can have no purchase
// category.
export function normalizeInventoryCategory(raw) {
  const compact = String(raw || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (!compact) return FINISHED_GOODS;
  if (compact.includes("PACK")) return PACKING_MATERIAL;
  if (compact.includes("FINISHED") || compact === "FG") return FINISHED_GOODS;
  if (
    compact.includes("RAW") ||
    compact.includes("ADDITIVE") ||
    compact.includes("CATALYST") ||
    compact === "RM"
  ) {
    return RAW_MATERIAL;
  }
  // An unrecognised category is still a purchased input — it came in on a PO,
  // so it is not finished goods.
  return RAW_MATERIAL;
}

// Real-time net stock for a single item, used by dispatch to decide what's
// actually available to ship regardless of which batch/production it came from.
// Pass batchNo to scope the same calculation down to one specific batch line
// (used by production batch substitution to check a substitute batch has
// enough stock, and that the original batch's stock nets out after reversal).
// Pass `client` (a Prisma transaction client) to read the ledger inside the
// same transaction that is about to write to it. Callers that gate a write on
// available stock MUST do this — reading outside the transaction lets two
// concurrent requests both see the same stock and each spend it, driving the
// ledger negative.
export async function getAvailableInventoryQty(itemId, batchNo, client = prisma) {
  const normalized = String(itemId || "").trim();
  if (!normalized) return 0;

  const grouped = await client.inventoryTransaction.groupBy({
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

// The most recent date on which any stock actually moved, as "YYYY-MM-DD", or
// null if the ledger is empty. The register opens on this rather than on today,
// because an empty "today" made the screen look broken every morning before the
// first movement was logged.
export async function getLatestStockMovementDate() {
  const rows = await prisma.$queryRawUnsafe(
    "SELECT DATE(MAX(createdAt)) AS d FROM InventoryTransaction"
  );
  const value = rows?.[0]?.d;
  if (!value) return null;
  // MySQL DATE() comes back as a Date at UTC midnight; slice the day key off.
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

// Daily stock movement register (Opening Stock / Production(received) /
// Dispatch / Consume by shift / Closing Stock) per item+batch, computed
// entirely from the InventoryTransaction ledger for the given date.
export async function getStockRegister(dateStr, category) {
  const startOfDay = new Date(`${String(dateStr || "").trim()}T00:00:00.000Z`);
  if (Number.isNaN(startOfDay.getTime())) {
    const error = new Error("A valid date is required.");
    error.statusCode = 400;
    throw error;
  }
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Un-batched movement is still movement. Most of the ledger carries no batch
  // number at all — production, packing, dispatch and manual adjustments never
  // set one, and a GRN only has one if the buyer typed a batch on the PO line —
  // so filtering those rows out left this register permanently empty. They now
  // group under a single no-batch row per item.
  const [openingGrouped, todayGrouped] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ["itemId", "batchNo", "type"],
      where: { createdAt: { lt: startOfDay } },
      _sum: { quantity: true }
    }),
    prisma.inventoryTransaction.groupBy({
      by: ["itemId", "batchNo", "type", "shift", "reference"],
      where: { createdAt: { gte: startOfDay, lt: endOfDay } },
      _sum: { quantity: true }
    })
  ]);

  // Opening stock is a starting balance the user declares, not production output.
  // On any later day it already lands in the Opening column (it is prior-day
  // history); on the very day it is entered it must do the same, or the register
  // shows a 0 opening with the whole balance mislabelled as "Production".
  const isOpeningStockReference = (reference) => /opening stock/i.test(String(reference || ""));

  const rowsByKey = new Map();
  const keyOf = (itemId, batchNo) => `${itemId}::${batchNo ?? ""}`;
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
      // without a shift is a plain receipt — except an opening-stock entry,
      // which is a starting balance and belongs in the Opening column.
      if (shift === "A") entry.consumeAShift -= qty;
      else if (shift === "B") entry.consumeBShift -= qty;
      else if (shift === "C") entry.consumeCShift -= qty;
      else if (isOpeningStockReference(row.reference)) entry.openingStock += qty;
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
  // Most stock never arrives on a GRN (production output, packing material
  // consumed straight off an adjustment), so the ledger's own category is the
  // only thing that can place those rows on the right screen. GRN wins where
  // it exists — it describes what physically arrived.
  const [grnItems, ledgerMeta, curated] = itemIds.length
    ? await Promise.all([
        prisma.grnItem.findMany({
          where: { itemId: { in: itemIds } },
          select: { itemId: true, grade: true, category: true },
          orderBy: { id: "desc" }
        }),
        prisma.inventoryTransaction.findMany({
          where: { itemId: { in: itemIds }, OR: [{ category: { not: null } }, { grade: { not: null } }] },
          select: { itemId: true, grade: true, category: true },
          orderBy: { id: "desc" }
        }),
        getCuratedCategories()
      ])
    : [[], [], new Map()];
  const gradeByItemId = new Map();
  const categoryByItemId = new Map();
  for (const gi of grnItems) {
    if (!gradeByItemId.has(gi.itemId)) gradeByItemId.set(gi.itemId, gi.grade || "");
    if (!categoryByItemId.has(gi.itemId)) categoryByItemId.set(gi.itemId, gi.category || "");
  }
  for (const row of ledgerMeta) {
    if (!gradeByItemId.get(row.itemId)) gradeByItemId.set(row.itemId, row.grade || "");
    if (!categoryByItemId.get(row.itemId)) categoryByItemId.set(row.itemId, row.category || "");
  }
  // Curated last so it overwrites, not fills in — see getCuratedCategories.
  // Matched case-insensitively for the same reason as the stock list: the
  // master and the ledger disagree on casing for some products.
  const curatedByKey = new Map();
  for (const [name, meta] of curated) {
    if (meta.category) curatedByKey.set(name.toUpperCase(), meta.category);
  }
  for (const itemId of itemIds) {
    const curatedCategory = curatedByKey.get(String(itemId).toUpperCase());
    if (curatedCategory) categoryByItemId.set(itemId, curatedCategory);
  }

  let rows = [...rowsByKey.values()]
    .map((entry) => {
      const consumeTotal = entry.consumeAShift + entry.consumeBShift + entry.consumeCShift;
      const closingStock = entry.openingStock + entry.production - entry.dispatch - consumeTotal;
      return {
        ...entry,
        grade: gradeByItemId.get(entry.itemId) || "",
        category: categoryByItemId.get(entry.itemId) || "",
        closingStock
      };
    })
    .filter((row) => row.openingStock !== 0 || row.production !== 0 || row.dispatch !== 0 ||
      row.consumeAShift !== 0 || row.consumeBShift !== 0 || row.consumeCShift !== 0 || row.closingStock !== 0);

  if (category) {
    const wanted = normalizeInventoryCategory(category);
    rows = rows.filter((row) => normalizeInventoryCategory(row.category) === wanted);
  }

  // batchNo is null for the un-batched movement that makes up most of the
  // ledger (see the groupBy above), so both keys compare defensively.
  return rows.sort((a, b) => (a.itemId || "").localeCompare(b.itemId || "") || (a.batchNo || "").localeCompare(b.batchNo || ""));
}

// Products catalogued in the master but with no ledger movement yet. Without
// these, a product added on the Product Master screen is invisible on its
// inventory screen until something first moves it, which reads as "my product
// vanished". They join the list at zero so the screen shows the full catalogue
// and stock-outs are obvious.
//
// Deliberately only products with an explicit category: the master is seeded
// from the old product-name list with the category left blank for an admin to
// fill in, and "no category" reads as finished goods further down — so
// including them would dump the entire uncategorised catalogue onto the
// Finished Goods screen.
async function getCataloguedProductsWithoutStock() {
  try {
    return await prisma.$queryRawUnsafe(
      "SELECT `productName`, `category`, `defaultUnit` FROM `ProductMaster` " +
      "WHERE `isActive` = 1 AND `category` IS NOT NULL AND TRIM(`category`) <> ''"
    );
  } catch {
    // ProductMaster is a raw-managed table that self-creates on first master
    // data load; before that a missing table must not break the stock screen.
    return [];
  }
}

// The product master is the admin-curated answer to "what kind of item is
// this", so it outranks anything inferred from history. Without that
// precedence an item mislabelled once — an opening-stock import that tagged a
// finished product "Raw Material", say — would be stuck on the wrong screen
// forever, with no way for an admin to correct it.
async function getCuratedCategories() {
  const map = new Map();
  for (const row of await getCataloguedProductsWithoutStock()) {
    const itemId = String(row.productName || "").trim();
    if (itemId) map.set(itemId, { category: row.category || "", uom: row.defaultUnit || "" });
  }
  return map;
}

export async function getRawMaterialInventory(query = {}) {
  const { search, category, uom, grade } = query;

  // Sum quantities per itemId/type at the DB level instead of loading every
  // transaction row into memory (the ledger only grows over time).
  const [grouped, catalogueRows] = await Promise.all([
    prisma.inventoryTransaction.groupBy({
      by: ["itemId", "type"],
      _sum: { quantity: true }
    }),
    getCataloguedProductsWithoutStock()
  ]);

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

  // Match the catalogue to the ledger case-insensitively. MySQL compares
  // strings that way, so the master can hold "ZINC STEARATE" while the ledger
  // carries "Zinc Stearate" for the very same product — a case-sensitive
  // lookup here silently matches neither, which is what stopped a curated
  // category from taking effect.
  const catalogueMeta = new Map();
  const stockKeyByName = new Map();
  for (const itemId of stockMap.keys()) {
    stockKeyByName.set(itemId.toUpperCase(), itemId);
  }
  for (const row of catalogueRows) {
    const productName = String(row.productName || "").trim();
    if (!productName) continue;
    const key = productName.toUpperCase();
    const existingItemId = stockKeyByName.get(key);
    catalogueMeta.set(existingItemId || productName, {
      category: row.category || "",
      uom: row.defaultUnit || ""
    });
    if (!existingItemId) {
      stockMap.set(productName, {
        itemId:            productName,
        totalIn:           0,
        totalOut:          0,
        netQty:            0,
        warehouseLocation: "",
        lastReceivedAt:    null
      });
      stockKeyByName.set(key, productName);
    }
  }

  if (stockMap.size === 0) {
    return { items: [], summary: { totalItems: 0, totalQtyIn: 0, totalQtyOut: 0 } };
  }

  // Only true GRN receipts ("IN") count toward "last received" metadata —
  // manual adjustments/reversals aren't real deliveries.
  //
  // We only want the single latest receipt per item, so ask the database for
  // exactly that. Fetching every IN row and keeping the first one seen per item
  // means dragging the entire receipt history across the wire on every page
  // load, and the ledger is append-only — it only ever gets bigger.
  const receipts = await prisma.$queryRawUnsafe(
    "SELECT `itemId`, `warehouseLocation`, `createdAt` FROM (" +
    "  SELECT `itemId`, `warehouseLocation`, `createdAt`," +
    "         ROW_NUMBER() OVER (PARTITION BY `itemId` ORDER BY `createdAt` DESC, `id` DESC) AS rn" +
    "  FROM `InventoryTransaction` WHERE `type` = 'IN'" +
    ") ranked WHERE rn = 1"
  );
  for (const receipt of receipts) {
    const entry = stockMap.get(receipt.itemId);
    if (entry) {
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
      where:   {
        itemId: { in: unmetaItemIds },
        OR: [{ uom: { not: null } }, { grade: { not: null } }, { category: { not: null } }]
      },
      select:  { itemId: true, uom: true, grade: true, category: true },
      orderBy: { id: "desc" }
    });
    // Scan newest-first but keep looking past blanks: production and dispatch
    // rows carry no category, so taking only the newest row would drop the
    // category an item was actually received under. Same rule as the stock
    // register, so an item can't land on one screen there and another here.
    for (const row of fallbackRows) {
      const existing = metaMap.get(row.itemId);
      if (!existing) {
        metaMap.set(row.itemId, {
          category: row.category || "",
          uom: row.uom || "",
          grade: row.grade || "",
          batchNo: ""
        });
        continue;
      }
      if (!existing.category) existing.category = row.category || "";
      if (!existing.uom) existing.uom = row.uom || "";
      if (!existing.grade) existing.grade = row.grade || "";
    }
  }

  // The product master's curated category overrides whatever history inferred
  // (see getCuratedCategories); its unit only fills a gap, since a GRN records
  // the unit the goods actually arrived in.
  for (const [itemId, meta] of catalogueMeta) {
    const existing = metaMap.get(itemId);
    if (!existing) {
      metaMap.set(itemId, { category: meta.category, uom: meta.uom, grade: "", batchNo: "" });
    } else {
      if (meta.category) existing.category = meta.category;
      if (!existing.uom) existing.uom = meta.uom;
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
    const wanted = normalizeInventoryCategory(category);
    items = items.filter((item) => normalizeInventoryCategory(item.category) === wanted);
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

  // An adjustment out cannot remove more than the item actually has — that would
  // book negative stock, which is physically impossible and only ever a typo or
  // a missing opening balance. The read and the write share one transaction so
  // two concurrent adjustments can't both pass against the same stock. An
  // adjustment *in* has nothing to check.
  const transaction = await prisma.$transaction(async (tx) => {
    if (direction === "OUT") {
      const available = await getAvailableInventoryQty(itemId, undefined, tx);
      if (quantity > available) {
        const error = new Error(
          `Cannot remove ${quantity} of ${itemId}: only ${available} in stock.`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    return tx.inventoryTransaction.create({
      data: {
        type:      direction === "IN" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        itemId,
        quantity,
        reference: "Manual Adjustment",
        remarks:   reason
      }
    });
  });

  return transaction;
}

// Bulk opening-stock import (e.g. from an Excel stock take): each row sets
// the target on-hand quantity for an item/batch. Rather than inserting the
// target directly, we diff it against current net stock and record just the
// delta as an adjustment — so the ledger stays a true transaction history
// instead of an absolute snapshot, and existing IN/OUT history is preserved.
// `reference` labels the ledger entries so an audit can tell where a stock take
// came from — the Excel importer by default, but also single opening balances
// seeded when a product is added to the master.
export async function importOpeningStock(rows, actorUser, { reference = "Excel Import - Opening Stock" } = {}) {
  const importBatch = `IMPORT-${Date.now()}`;
  let skipped = 0;
  const errors = [];

  // Validate first, so one bad row doesn't cost a database round-trip.
  const parsed = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    try {
      const itemId = String(row.item_id || "").trim();
      if (!itemId) throw new Error("Item ID is required.");

      const targetQty = Number(row.quantity);
      if (!Number.isFinite(targetQty) || targetQty < 0) {
        throw new Error("Quantity must be a non-negative number.");
      }

      parsed.push({
        row,
        itemId,
        targetQty,
        batchNo: row.batch_no ? String(row.batch_no).trim() : undefined
      });
    } catch (error) {
      errors.push({ row: index + 1, message: error?.message || "Import failed" });
    }
  }

  // Read the current stock for every item in the sheet in ONE query. The old
  // code ran a groupBy per row and inserted per row, so a 500-row stock take
  // cost ~1,000 serial round-trips.
  const itemIds = [...new Set(parsed.map((p) => p.itemId))];
  const grouped = itemIds.length
    ? await prisma.inventoryTransaction.groupBy({
        by: ["itemId", "batchNo", "type"],
        where: { itemId: { in: itemIds } },
        _sum: { quantity: true }
      })
    : [];

  // Net stock per item, and per item+batch — mirroring getAvailableInventoryQty:
  // a row with no batch number is compared against the item's total across all
  // batches; a row with one is compared against just that batch.
  const netByItem = new Map();
  const netByItemBatch = new Map();
  const batchKey = (itemId, batchNo) => `${itemId}::${batchNo || ""}`;

  for (const g of grouped) {
    const qty = g._sum.quantity || 0;
    const signed = CREDIT_TYPES.has(g.type) ? qty : DEBIT_TYPES.has(g.type) ? -qty : 0;
    netByItem.set(g.itemId, (netByItem.get(g.itemId) || 0) + signed);
    const key = batchKey(g.itemId, g.batchNo);
    netByItemBatch.set(key, (netByItemBatch.get(key) || 0) + signed);
  }

  const data = [];
  for (const { itemId, targetQty, batchNo, row } of parsed) {
    const key = batchKey(itemId, batchNo);
    const currentQty = batchNo === undefined
      ? (netByItem.get(itemId) || 0)
      : (netByItemBatch.get(key) || 0);

    const delta = Math.round((targetQty - currentQty) * 1e6) / 1e6;
    if (delta === 0) {
      skipped += 1;
      continue;
    }

    // Apply the delta in memory so a later row for the same item/batch sees it,
    // exactly as it would have when each row was written before the next was read.
    netByItem.set(itemId, (netByItem.get(itemId) || 0) + delta);
    netByItemBatch.set(key, (netByItemBatch.get(key) || 0) + delta);

    data.push({
      type:      delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
      itemId,
      quantity:  Math.abs(delta),
      category:  row.category || null,
      uom:       row.uom || null,
      grade:     row.grade || null,
      batchNo:   batchNo || null,
      reference,
      remarks:   `Stock take import: set to ${targetQty} (was ${currentQty})`,
      importBatch
    });
  }

  if (data.length > 0) {
    await prisma.inventoryTransaction.createMany({ data });
  }

  return {
    importBatch,
    total: rows.length,
    imported: data.length,
    skipped,
    failed: errors.length,
    errors
  };
}
