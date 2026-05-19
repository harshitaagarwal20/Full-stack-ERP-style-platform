import prisma from "../config/prisma.js";

export async function getRawMaterialInventory(query = {}) {
  const { search, category } = query;

  // All inventory transactions
  const transactions = await prisma.inventoryTransaction.findMany({
    select: {
      itemId:            true,
      type:              true,
      quantity:          true,
      warehouseLocation: true,
      createdAt:         true
    },
    orderBy: { createdAt: "desc" }
  });

  // Aggregate net stock per itemId
  const stockMap = new Map();
  for (const txn of transactions) {
    if (!stockMap.has(txn.itemId)) {
      stockMap.set(txn.itemId, {
        itemId:            txn.itemId,
        totalIn:           0,
        totalOut:          0,
        netQty:            0,
        warehouseLocation: "",
        lastReceivedAt:    null
      });
    }
    const entry = stockMap.get(txn.itemId);
    if (txn.type === "IN") {
      entry.totalIn += txn.quantity;
      if (!entry.lastReceivedAt || txn.createdAt > entry.lastReceivedAt) {
        entry.lastReceivedAt    = txn.createdAt;
        entry.warehouseLocation = txn.warehouseLocation || entry.warehouseLocation;
      }
    } else {
      entry.totalOut += txn.quantity;
    }
    entry.netQty = entry.totalIn - entry.totalOut;
  }

  if (stockMap.size === 0) {
    return { items: [], summary: { totalItems: 0, totalQtyIn: 0, totalQtyOut: 0 } };
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

  // Sort: low stock first, then alphabetical
  items.sort((a, b) => a.netQty - b.netQty || a.itemId.localeCompare(b.itemId));

  const summary = {
    totalItems:  items.length,
    totalQtyIn:  items.reduce((s, i) => s + i.totalIn,  0),
    totalQtyOut: items.reduce((s, i) => s + i.totalOut, 0)
  };

  return { items, summary };
}
