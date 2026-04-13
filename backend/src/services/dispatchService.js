import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { DISPATCH_LIST_SELECT } from "../utils/selects.js";

let hasExportDateColumnCache;

function getDeliveredQuantity(dispatches = []) {
  return dispatches.reduce((sum, item) => sum + (item.dispatchedQuantity || 0), 0);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function generateOrderNo(id) {
  return `ORD-${String(id).padStart(6, "0")}`;
}

function generateSalesOrderNumber(id) {
  return `SO-${String(id).padStart(6, "0")}`;
}

async function hasOrderExportDateColumn() {
  if (typeof hasExportDateColumnCache === "boolean") return hasExportDateColumnCache;
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Order'
      AND COLUMN_NAME = 'exportDate'
  `;
  const count = Number(rows?.[0]?.count ?? 0);
  hasExportDateColumnCache = count > 0;
  return hasExportDateColumnCache;
}

async function syncOrderDispatchStatus(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      quantity: true,
      dispatches: {
        select: {
          dispatchedQuantity: true
        }
      }
    }
  });
  if (!order) return;

  const delivered = getDeliveredQuantity(order.dispatches);
  const nextStatus = delivered >= order.quantity ? "DISPATCHED" : "COMPLETED";

  await tx.order.update({
    where: { id: orderId },
    data: { status: nextStatus }
  });
}

export async function getDispatchDashboard(query = {}) {
  const q = query.q;

  const [completedOrders, dispatches, approvedEnquiriesPendingExportDate] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "COMPLETED",
        production: {
          status: "COMPLETED"
        },
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
        quantity: true,
        unit: true,
        packingType: true,
        packingSize: true,
        deliveryDate: true,
        clientName: true,
        city: true,
        pincode: true,
        state: true,
        countryCode: true,
        status: true,
        updatedAt: true,
        production: {
          select: {
            id: true,
            status: true,
            productionCompletionDate: true
          }
        },
        dispatches: {
          select: {
            id: true,
            dispatchedQuantity: true,
            dispatchDate: true,
            shipmentStatus: true
          },
          orderBy: {
            createdAt: "desc"
          }
        }
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }]
    }),
    prisma.dispatch.findMany({
      where: {
        ...(q
          ? {
              OR: [
                { order: { salesOrderNumber: { contains: q } } },
                { order: { orderNo: { contains: q } } },
                { order: { clientName: { contains: q } } }
              ]
            }
          : {})
      },
      select: DISPATCH_LIST_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    }),
    prisma.enquiry.findMany({
      where: {
        status: "ACCEPTED",
        order: null,
        ...(q
          ? {
              OR: [
                { companyName: { contains: q } },
                { product: { contains: q } }
              ]
            }
          : {})
      },
      select: {
        id: true,
        companyName: true,
        product: true,
        quantity: true,
        unitOfMeasurement: true,
        expectedTimeline: true,
        assignedPerson: true,
        status: true,
        createdAt: true
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }]
    })
  ]);

  const readyOrders = completedOrders
    .map((order) => {
      const deliveredQuantity = getDeliveredQuantity(order.dispatches);
      const remainingQuantity = Math.max(order.quantity - deliveredQuantity, 0);
      return {
        ...order,
        deliveredQuantity,
        remainingQuantity
      };
    })
    .filter((order) => order.remainingQuantity > 0);

  const exportDateOrders = approvedEnquiriesPendingExportDate.map((enquiry) => ({
    id: enquiry.id,
    salesOrderNumber: `ENQ-${String(enquiry.id).padStart(6, "0")}`,
    orderNo: "-",
    product: enquiry.product,
    quantity: enquiry.quantity,
    unit: enquiry.unitOfMeasurement || "KG",
    clientName: enquiry.companyName,
    deliveryDate: enquiry.expectedTimeline,
    status: enquiry.status,
    createdAt: enquiry.createdAt,
    source: "ENQUIRY"
  }));

  return { readyOrders, dispatches, exportDateOrders };
}

export async function updateOrderExportDate(enquiryId, payload, actorUser) {
  const exportDate = parseDateInput(payload.export_date);
  if (!exportDate) {
    const error = new Error("Export date is required.");
    error.statusCode = 400;
    throw error;
  }

  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      status: true,
      companyName: true,
      product: true,
      quantity: true,
      unitOfMeasurement: true,
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
    const error = new Error("Only approved enquiries can be converted to order.");
    error.statusCode = 400;
    throw error;
  }

  if (enquiry.order) {
    const error = new Error("Order already exists for this enquiry.");
    error.statusCode = 409;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const hasExportDateColumn = await hasOrderExportDateColumn();
    const validUnits = new Set(["KG", "MT", "LTR"]);
    const unit = validUnits.has(enquiry.unitOfMeasurement) ? enquiry.unitOfMeasurement : "KG";

    const createdOrder = await tx.order.create({
      data: {
        enquiryId: enquiry.id,
        createdById: actorUser.id,
        salesOrderNumber: `TSO-${Date.now()}-${enquiry.id}`,
        orderNo: `TMP-${Date.now()}-${enquiry.id}`,
        product: enquiry.product,
        grade: "NA",
        quantity: enquiry.quantity,
        unit,
        packingType: "NA",
        packingSize: "NA",
        deliveryDate: exportDate,
        clientName: enquiry.companyName,
        address: "",
        city: "",
        pincode: "",
        state: "",
        countryCode: "IN",
        remarks: `Created from approved enquiry #${enquiry.id} via dispatch export date`,
        status: "CREATED",
        ...(hasExportDateColumn ? { exportDate } : {})
      },
      select: {
        id: true
      }
    });

    const updated = await tx.order.update({
      where: { id: createdOrder.id },
      data: {
        salesOrderNumber: generateSalesOrderNumber(createdOrder.id),
        orderNo: generateOrderNo(createdOrder.id)
      },
      select: {
        id: true,
        salesOrderNumber: true,
        orderNo: true
      }
    });

    await recordAuditEvent({
      tx,
      action: "CREATE_ORDER",
      entityType: "Order",
      entityId: updated.id,
      user: actorUser,
      oldValue: null,
      newValue: {
        enquiryId: enquiry.id,
        salesOrderNumber: updated.salesOrderNumber,
        exportDate
      },
      note: `Created order #${updated.id} from approved enquiry #${enquiry.id} with export date`
    });

    return updated;
  });
}

export async function createDispatch(payload, actorUser) {
  const dispatchDateValue = parseDateInput(payload.dispatch_date);
  if (!dispatchDateValue) {
    const error = new Error("Dispatch date is required.");
    error.statusCode = 400;
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id: payload.order_id },
    select: {
      id: true,
      quantity: true,
      status: true,
      salesOrderNumber: true,
      clientName: true,
      production: {
        select: {
          id: true,
          status: true
        }
      },
      dispatches: {
        select: {
          dispatchedQuantity: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (!order.production || order.production.status !== "COMPLETED" || (order.status !== "COMPLETED" && order.status !== "DISPATCHED")) {
    const error = new Error("Cannot dispatch unless order status is COMPLETED.");
    error.statusCode = 400;
    throw error;
  }

  const deliveredQuantity = getDeliveredQuantity(order.dispatches);
  const remainingQuantity = Math.max(order.quantity - deliveredQuantity, 0);
  if (remainingQuantity <= 0) {
    const error = new Error("Order is already fully dispatched.");
    error.statusCode = 409;
    throw error;
  }
  if (payload.dispatch_quantity > remainingQuantity) {
    const error = new Error(`Dispatch quantity cannot exceed remaining quantity (${remainingQuantity}).`);
    error.statusCode = 400;
    throw error;
  }

  const dispatch = await prisma.$transaction(async (tx) => {
    const created = await tx.dispatch.create({
      data: {
        orderId: payload.order_id,
        dispatchedQuantity: payload.dispatch_quantity,
        dispatchDate: dispatchDateValue,
        packingDone: payload.packing_done,
        shipmentStatus: payload.shipment_status,
        remarks: payload.remarks
      },
      select: DISPATCH_LIST_SELECT
    });

    await syncOrderDispatchStatus(tx, payload.order_id);
    await recordAuditEvent({
      tx,
      action: "CREATE_DISPATCH",
      entityType: "Dispatch",
      entityId: created.id,
      user: actorUser,
      newValue: created,
      note: `Created dispatch for order #${payload.order_id}`
    });
    return created;
  });

  return dispatch;
}

export async function updateDispatch(dispatchId, payload, actorUser) {
  const parsedDispatchDate = payload.dispatch_date ? parseDateInput(payload.dispatch_date) : undefined;
  if (payload.dispatch_date && !parsedDispatchDate) {
    const error = new Error("Dispatch date is invalid.");
    error.statusCode = 400;
    throw error;
  }

  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      id: true,
      orderId: true,
      dispatchedQuantity: true,
      dispatchDate: true,
      packingDone: true,
      shipmentStatus: true,
      remarks: true,
      order: {
        select: {
          id: true,
          quantity: true,
          dispatches: {
            select: {
              id: true,
              dispatchedQuantity: true
            }
          }
        }
      }
    }
  });

  if (!dispatch) {
    const error = new Error("Dispatch record not found.");
    error.statusCode = 404;
    throw error;
  }

  const currentTotal = getDeliveredQuantity(dispatch.order.dispatches);
  const currentRowQty = dispatch.dispatchedQuantity || 0;
  const incomingQty = payload.dispatch_quantity ?? currentRowQty;
  const remainingWithoutCurrent = Math.max(dispatch.order.quantity - (currentTotal - currentRowQty), 0);
  if (incomingQty > remainingWithoutCurrent) {
    const error = new Error(`Dispatch quantity cannot exceed remaining quantity (${remainingWithoutCurrent}).`);
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.dispatch.update({
      where: { id: dispatchId },
      data: {
        dispatchedQuantity: payload.dispatch_quantity,
        dispatchDate: parsedDispatchDate,
        packingDone: payload.packing_done,
        shipmentStatus: payload.shipment_status,
        remarks: payload.remarks
      },
      select: DISPATCH_LIST_SELECT
    });

    await syncOrderDispatchStatus(tx, dispatch.orderId);
    await recordAuditEvent({
      tx,
      action: "UPDATE_DISPATCH",
      entityType: "Dispatch",
      entityId: dispatchId,
      user: actorUser,
      oldValue: dispatch,
      newValue: updated,
      note: `Updated dispatch #${dispatchId}`
    });
    return updated;
  });
}

export async function deleteDispatch(dispatchId, actorUser) {
  const dispatch = await prisma.dispatch.findUnique({
    where: { id: dispatchId },
    select: {
      id: true,
      orderId: true
    }
  });

  if (!dispatch) {
    const error = new Error("Dispatch record not found.");
    error.statusCode = 404;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_DISPATCH",
      entityType: "Dispatch",
      entityId: dispatchId,
      user: actorUser,
      oldValue: dispatch,
      note: `Deleted dispatch #${dispatchId}`
    });

    await tx.dispatch.delete({ where: { id: dispatchId } });
    await syncOrderDispatchStatus(tx, dispatch.orderId);
  });

  return { id: dispatchId };
}
