import prisma from "../config/prisma.js";
import { getAvailableInventoryQty } from "./inventoryService.js";
import { invalidateCacheByPrefix } from "../utils/responseCache.js";

function sumQty(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

function invalidatePackingCaches() {
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("orders:");
  invalidateCacheByPrefix("dashboard:");
}

// Orders whose finished goods have cleared QC (READY_FOR_DISPATCH /
// PARTIALLY_DISPATCHED, with at least one completed production batch) are
// the candidates for packing — the same set dispatch draws from, since
// packing has to happen before dispatch, not after.
export async function getPackingQueue(query = {}) {
  const q = String(query.q || "").trim();

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"] },
      productions: { some: { status: "COMPLETED" } },
      ...(q
        ? {
            OR: [
              { salesOrderNumber: { contains: q } },
              { orderNo: { contains: q } },
              { clientName: { contains: q } },
              { product: { contains: q } }
            ]
          }
        : {})
    },
    select: {
      id: true,
      salesOrderNumber: true,
      orderNo: true,
      product: true,
      grade: true,
      quantity: true,
      unit: true,
      packingType: true,
      packingSize: true,
      clientName: true,
      status: true,
      updatedAt: true,
      dispatches: { select: { dispatchedQuantity: true } },
      packingRecords: {
        select: { id: true, packedQuantity: true, packingMaterialItemId: true, packingMaterialQty: true, packedBy: true, createdAt: true },
        orderBy: { createdAt: "desc" }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
  });

  return orders.map((order) => {
    const dispatchedQuantity = sumQty(order.dispatches, "dispatchedQuantity");
    const packedQuantity = sumQty(order.packingRecords, "packedQuantity");
    const remainingToPack = Math.max(order.quantity - packedQuantity, 0);
    const remainingToDispatch = Math.max(packedQuantity - dispatchedQuantity, 0);
    const { dispatches, ...rest } = order;
    return {
      ...rest,
      dispatchedQuantity,
      packedQuantity,
      remainingToPack,
      remainingToDispatch
    };
  });
}

export async function createPackingRecord(payload, actorUser) {
  const packingMaterialItemId = String(payload.packing_material_item_id || "").trim();
  const packedQuantity = Number(payload.packed_quantity);
  const packingMaterialQty = Number(payload.packing_material_qty);

  // All quantity gates run INSIDE the write transaction. Checking stock first
  // and writing after let two concurrent packing entries each see the same
  // finished-goods / packing-material stock and both consume it.
  const record = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: payload.order_id },
      select: {
        id: true,
        product: true,
        quantity: true,
        status: true,
        dispatches: { select: { dispatchedQuantity: true } },
        packingRecords: { select: { packedQuantity: true } }
      }
    });

    if (!order) {
      const error = new Error("Order not found.");
      error.statusCode = 404;
      throw error;
    }

    if (!["READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED"].includes(order.status)) {
      const error = new Error("Order has no QC-passed finished goods ready to pack yet.");
      error.statusCode = 400;
      throw error;
    }

    const alreadyPacked = sumQty(order.packingRecords, "packedQuantity");
    const remainingToPack = order.quantity - alreadyPacked;
    if (packedQuantity > remainingToPack) {
      const error = new Error(`Packed quantity cannot exceed the remaining order quantity (${remainingToPack}).`);
      error.statusCode = 400;
      throw error;
    }

    // Packing can't get ahead of what's actually sitting in finished-goods
    // inventory (i.e. what's cleared QC so far).
    const availableFinishedGoods = await getAvailableInventoryQty(order.product, undefined, tx);
    if (packedQuantity > availableFinishedGoods) {
      const error = new Error(`Packed quantity cannot exceed available finished-goods stock (${availableFinishedGoods}).`);
      error.statusCode = 400;
      throw error;
    }

    const availableMaterialQty = await getAvailableInventoryQty(packingMaterialItemId, undefined, tx);
    if (packingMaterialQty > availableMaterialQty) {
      const error = new Error(`Insufficient packing material stock for "${packingMaterialItemId}" (available: ${availableMaterialQty}).`);
      error.statusCode = 400;
      throw error;
    }

    const created = await tx.packingRecord.create({
      data: {
        orderId: payload.order_id,
        packedQuantity,
        packingMaterialItemId,
        packingMaterialQty,
        packedBy: payload.packed_by || actorUser?.name || null,
        remarks: payload.remarks || null
      }
    });

    await tx.inventoryTransaction.create({
      data: {
        type: "OUT",
        itemId: packingMaterialItemId,
        quantity: packingMaterialQty,
        reference: `Packing for Order #${payload.order_id}`,
        remarks: `Used to pack ${packedQuantity} of ${order.product}`
      }
    });



    return created;
  });

  invalidatePackingCaches();
  return record;
}
