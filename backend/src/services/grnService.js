import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { GRN_LIST_SELECT, GRN_DETAIL_SELECT } from "../utils/selects.js";
import { formatGRNNumber } from "../utils/businessNumbers.js";

const GRN_CACHE_PREFIX = "grns:list";
const GRN_CACHE_TTL_MS = 12 * 1000;

function invalidateGRNCaches() {
  invalidateCacheByPrefix("grns:");
  invalidateCacheByPrefix("purchase-orders:");
  invalidateCacheByPrefix("dashboard:");
}

export async function createGRN(payload, user) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: payload.po_id },
    select: {
      id: true,
      status: true,
      poNumber: true,
      items: {
        select: {
          id: true, itemId: true, qty: true, receivedQty: true,
          category: true, grade: true, uom: true, currency: true,
          unitPrice: true, taxPercent: true, expDaysDelivery: true, batchNo: true
        }
      }
    }
  });

  if (!po) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  const receivableStatuses = ["SENT_TO_SUPPLIER", "PARTIALLY_RECEIVED"];
  if (!receivableStatuses.includes(po.status)) {
    const error = new Error("PO must be in 'Sent to Supplier' status to create a GRN.");
    error.statusCode = 400;
    throw error;
  }

  const poItemMap = new Map(po.items.map((i) => [i.id, i]));

  for (const payloadItem of payload.items) {
    if (!poItemMap.has(payloadItem.po_item_id)) {
      const error = new Error(`PO item ${payloadItem.po_item_id} does not belong to this PO.`);
      error.statusCode = 400;
      throw error;
    }
  }

  const tmpKey = `TMP-GRN-${Date.now()}`;
  const grn = await prisma.goodsReceiptNote.create({
    data: {
      grnNumber:         tmpKey,
      poId:              po.id,
      receivedDate:      payload.received_date ? new Date(payload.received_date) : new Date(),
      receivedBy:        payload.received_by   || null,
      vehicleRef:        payload.vehicle_ref   || null,
      warehouseLocation: payload.warehouse_location || null,
      remarks:           payload.remarks       || null,
      status:            "DRAFT"
    }
  });

  const grnNumber = formatGRNNumber(grn.id);

  const itemsData = payload.items.map((payloadItem) => {
    const poItem = poItemMap.get(payloadItem.po_item_id);
    return {
      poItemId:         poItem.id,
      itemId:           poItem.itemId,
      category:         poItem.category  || null,
      grade:            poItem.grade     || null,
      uom:              poItem.uom       || null,
      currency:         poItem.currency  || null,
      unitPrice:        poItem.unitPrice  ?? null,
      taxPercent:       poItem.taxPercent ?? null,
      batchNo:          poItem.batchNo   || null,
      quantityOrdered:  poItem.qty,
      quantityReceived: Number(payloadItem.quantity_received) || 0,
      remarks:          payloadItem.remarks || null
    };
  });

  await prisma.goodsReceiptNote.update({
    where: { id: grn.id },
    data: {
      grnNumber,
      items: { create: itemsData }
    }
  });

  await recordAuditEvent({
    action:     "CREATE",
    entityType: "GoodsReceiptNote",
    entityId:   grn.id,
    user,
    newValue:   { grnNumber, poId: po.id }
  });

  invalidateGRNCaches();
  return getGRN(grn.id);
}

export async function listGRNs(query = {}) {
  const { page, limit, skip, take } = buildPagination(query, { defaultLimit: 10, maxLimit: 100 });

  const where = {};

  if (query.status && query.status !== "all") {
    where.status = query.status;
  }

  if (query.po_id) {
    where.poId = Number(query.po_id);
  }

  if (query.q) {
    where.OR = [
      { grnNumber: { contains: query.q } },
      { purchaseOrder: { poNumber: { contains: query.q } } }
    ];
  }

  const cacheKey = buildCacheKey(GRN_CACHE_PREFIX, query);

  return getOrLoadCached(cacheKey, GRN_CACHE_TTL_MS, async () => {
    const [items, total] = await Promise.all([
      prisma.goodsReceiptNote.findMany({
        where,
        select: GRN_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      prisma.goodsReceiptNote.count({ where })
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
  });
}

export async function getGRN(id) {
  const grn = await prisma.goodsReceiptNote.findUnique({
    where: { id },
    select: GRN_DETAIL_SELECT
  });

  if (!grn) {
    const error = new Error("GRN not found.");
    error.statusCode = 404;
    throw error;
  }

  return grn;
}

export async function confirmGRN(id, user) {
  const result = await prisma.$transaction(async (tx) => {
    const grn = await tx.goodsReceiptNote.findUnique({
      where: { id },
      select: {
        id:                true,
        status:            true,
        poId:              true,
        grnNumber:         true,
        warehouseLocation: true,
        items: {
          select: {
            id:               true,
            poItemId:         true,
            itemId:           true,
            quantityReceived: true,
            remarks:          true
          }
        }
      }
    });

    if (!grn) {
      const error = new Error("GRN not found.");
      error.statusCode = 404;
      throw error;
    }

    if (grn.status !== "DRAFT") {
      const error = new Error("GRN is already confirmed.");
      error.statusCode = 400;
      throw error;
    }

    // Validate quantities
    for (const grnItem of grn.items) {
      if (grnItem.quantityReceived <= 0) {
        const error = new Error(`Item ${grnItem.itemId}: quantity received must be greater than 0.`);
        error.statusCode = 400;
        throw error;
      }

      const poItem = await tx.purchaseOrderItem.findUnique({
        where: { id: grnItem.poItemId },
        select: { id: true, qty: true, receivedQty: true }
      });

      if (!poItem) {
        const error = new Error(`PO item ${grnItem.poItemId} not found.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Increment receivedQty on each PO item
    for (const grnItem of grn.items) {
      await tx.purchaseOrderItem.update({
        where: { id: grnItem.poItemId },
        data: {
          receivedQty: { increment: grnItem.quantityReceived },
          receivedAt:  new Date()
        }
      });
    }

    // Determine new PO status by re-reading all items after increments
    const allPoItems = await tx.purchaseOrderItem.findMany({
      where: { poId: grn.poId },
      select: { qty: true, receivedQty: true }
    });

    const allFulfilled = allPoItems.every((item) => item.receivedQty >= item.qty);
    const newPoStatus  = allFulfilled ? "FULLY_RECEIVED" : "PARTIALLY_RECEIVED";

    await tx.purchaseOrder.update({
      where: { id: grn.poId },
      data:  { status: newPoStatus }
    });

    // Create InventoryTransaction for each item
    await tx.inventoryTransaction.createMany({
      data: grn.items.map((grnItem) => ({
        type:              "IN",
        itemId:            grnItem.itemId,
        quantity:          grnItem.quantityReceived,
        warehouseLocation: grn.warehouseLocation,
        reference:         grn.grnNumber,
        grnId:             grn.id,
        grnItemId:         grnItem.id,
        remarks:           grnItem.remarks || null
      }))
    });

    // Confirm the GRN
    return tx.goodsReceiptNote.update({
      where: { id },
      data:  { status: "CONFIRMED" }
    });
  });

  await recordAuditEvent({
    action:     "CONFIRM",
    entityType: "GoodsReceiptNote",
    entityId:   id,
    user,
    newValue:   { status: "CONFIRMED" }
  });

  invalidateGRNCaches();
  return getGRN(id);
}
