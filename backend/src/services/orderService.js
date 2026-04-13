import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { ORDER_LIST_SELECT } from "../utils/selects.js";

function generateOrderNo(id) {
  return `ORD-${String(id).padStart(6, "0")}`;
}

function generateSalesOrderNumber(id) {
  return `SO-${String(id).padStart(6, "0")}`;
}

function isNonEmpty(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export async function createOrder(payload, createdByUser) {
  const enquiryId = payload.enquiry_id ? Number(payload.enquiry_id) : null;
  let enquiry = null;

  if (enquiryId) {
    enquiry = await prisma.enquiry.findUnique({
      where: { id: enquiryId },
      select: {
        id: true,
        status: true,
        companyName: true,
        product: true,
        quantity: true,
        grade: true,
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
      const error = new Error("Cannot create order unless enquiry status is ACCEPTED.");
      error.statusCode = 400;
      throw error;
    }

    if (enquiry.order) {
      const error = new Error("Order already exists for this enquiry.");
      error.statusCode = 409;
      throw error;
    }
  }

  let finalOrder;

  if (enquiryId) {
    const order = await prisma.order.create({
      data: {
        enquiryId,
        createdById: createdByUser.id,
        salesOrderNumber: `TSO-${Date.now()}`,
        orderNo: `TMP-${Date.now()}`,
        product: payload.product,
        grade: payload.grade,
        quantity: payload.quantity,
        unit: payload.unit,
        packingType: payload.packing_type,
        packingSize: payload.packing_size,
        deliveryDate: new Date(payload.delivery_date),
        clientName: payload.client_name,
        address: payload.address,
        city: payload.city,
        pincode: payload.pincode,
        state: payload.state,
        countryCode: payload.country_code,
        remarks: payload.remarks,
        status: "CREATED"
      }
    });

    finalOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        salesOrderNumber: generateSalesOrderNumber(order.id),
        orderNo: generateOrderNo(order.id)
      },
      select: ORDER_LIST_SELECT
    });
  } else {
    await prisma.$executeRaw`
      INSERT INTO \`Order\`
        (\`enquiryId\`, \`salesOrderNumber\`, \`orderNo\`, \`product\`, \`grade\`, \`quantity\`, \`unit\`, \`packingType\`, \`packingSize\`, \`deliveryDate\`, \`clientName\`, \`address\`, \`city\`, \`pincode\`, \`state\`, \`countryCode\`, \`status\`, \`orderDate\`, \`remarks\`, \`createdAt\`, \`updatedAt\`, \`createdById\`)
      VALUES
        (NULL, ${`TSO-${Date.now()}`}, ${`TMP-${Date.now()}`}, ${payload.product}, ${payload.grade}, ${payload.quantity}, ${payload.unit}, ${payload.packing_type}, ${payload.packing_size}, ${new Date(payload.delivery_date)}, ${payload.client_name}, ${payload.address || null}, ${payload.city || null}, ${payload.pincode || null}, ${payload.state || null}, ${payload.country_code || null}, 'CREATED', NOW(3), ${payload.remarks || null}, NOW(3), NOW(3), ${createdByUser.id})
    `;

    const insertedRow = await prisma.$queryRaw`
      SELECT LAST_INSERT_ID() AS id
    `;
    const insertedId = Number(insertedRow?.[0]?.id);

    finalOrder = await prisma.order.findUnique({
      where: { id: insertedId },
      select: ORDER_LIST_SELECT
    });
  }

  await recordAuditEvent({
    action: "CREATE_ORDER",
    entityType: "Order",
    entityId: finalOrder.id,
    user: createdByUser,
    newValue: finalOrder,
    note: enquiryId
      ? `Created order #${finalOrder.id} from enquiry #${enquiryId}`
      : `Created manual order #${finalOrder.id}`
  });

  return finalOrder;
}

export async function listOrders(filters = {}) {
  const { status, q } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { salesOrderNumber: { contains: q } },
            { orderNo: { contains: q } },
            { clientName: { contains: q } },
            { product: { contains: q } },
            { grade: { contains: q } },
            { enquiry: { companyName: { contains: q } } }
          ]
        }
      : {})
  };

  const query = {
    where,
    select: ORDER_LIST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  };

  if (take > 0) {
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        ...query,
        skip,
        take
      }),
      prisma.order.count({ where })
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

  return prisma.order.findMany(query);
}

export async function moveOrderToProduction(orderId, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      city: true,
      pincode: true,
      state: true,
      countryCode: true,
      production: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (order.production) {
    const error = new Error("Production already exists for this order.");
    error.statusCode = 409;
    throw error;
  }

  if (order.status === "DISPATCHED" || order.status === "COMPLETED") {
    const error = new Error("Only active orders can move to production.");
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

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: { status: "IN_PRODUCTION" },
    select: ORDER_LIST_SELECT
  });

  await recordAuditEvent({
    action: "START_PRODUCTION",
    entityType: "Order",
    entityId: orderId,
    user: actorUser,
    oldValue: { status: order.status },
    newValue: { status: "IN_PRODUCTION" },
    note: `Moved order #${orderId} to production`
  });

  return updatedOrder;
}

export async function updateOrder(orderId, payload, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      production: {
        select: {
          id: true
        }
      },
      dispatches: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (order.production || (order.dispatches && order.dispatches.length > 0)) {
    const error = new Error("Cannot edit order after production/dispatch starts.");
    error.statusCode = 400;
    throw error;
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      product: payload.product,
      grade: payload.grade,
      quantity: payload.quantity,
      unit: payload.unit,
      packingType: payload.packing_type,
      packingSize: payload.packing_size,
      deliveryDate: payload.delivery_date ? new Date(payload.delivery_date) : undefined,
      clientName: payload.client_name,
      address: payload.address,
      city: payload.city,
      pincode: payload.pincode,
      state: payload.state,
      countryCode: payload.country_code,
      remarks: payload.remarks
    },
    select: ORDER_LIST_SELECT
  });

  await recordAuditEvent({
    action: "UPDATE_ORDER",
    entityType: "Order",
    entityId: orderId,
    user: actorUser,
    oldValue: order,
    newValue: updatedOrder,
    note: `Updated order #${orderId}`
  });

  return updatedOrder;
}

export async function deleteOrder(orderId, actorUser) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      production: {
        select: {
          id: true
        }
      },
      dispatches: {
        select: {
          id: true
        }
      }
    }
  });

  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (order.production || (order.dispatches && order.dispatches.length > 0)) {
    const error = new Error("Cannot delete order with production/dispatch records.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_ORDER",
      entityType: "Order",
      entityId: orderId,
      user: actorUser,
      oldValue: order,
      note: `Deleted order #${orderId}`
    });

    await tx.order.delete({
      where: { id: orderId }
    });

    return { id: orderId };
  });
}
