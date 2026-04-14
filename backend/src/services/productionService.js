import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { PRODUCTION_LIST_SELECT } from "../utils/selects.js";

function isNonEmpty(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

function parseDateInput(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
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

  const assignedPersonnel = payload.assigned_personnel?.trim() || order.clientName || "Production Team";
  const parsedDeliveryDate = parseDateInput(payload.delivery_date);
  const deliveryDateValue = parsedDeliveryDate || new Date(order.deliveryDate || new Date());
  const productSpecs = payload.product_specs?.trim() || `${order.product} ${order.grade ? `(${order.grade})` : ""}`.trim();
  const capacity = payload.capacity ?? order.quantity ?? 1;
  const particleSize = payload.particle_size?.trim() || "NA";
  const acmRpm = payload.acm_rpm ?? 1000;
  const classifierRpm = payload.classifier_rpm ?? 1000;
  const blowerRpm = payload.blower_rpm ?? 1000;
  const rawMaterials = payload.raw_materials?.trim() || order.packingType || "NA";
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

  return production;
}

export async function listProductionOrders(filters = {}) {
  const { q, status } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { order: { orderNo: { contains: q } } },
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
      data: { status: "COMPLETED" }
    });

    await recordAuditEvent({
      tx,
      action: "COMPLETE_PRODUCTION",
      entityType: "Production",
      entityId: productionId,
      user: actorUser,
      oldValue: { status: production.status },
      newValue: { status: "COMPLETED", productionCompletionDate: completionDate },
      note: `Completed production #${productionId}`
    });
  });

  return prisma.production.findUnique({
    where: { id: productionId },
    select: PRODUCTION_LIST_SELECT
  });
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

  const updateData = {};
  
  if (payload.assigned_personnel !== undefined && payload.assigned_personnel?.trim()) {
    updateData.assignedPersonnel = payload.assigned_personnel.trim();
  }
  if (payload.delivery_date !== undefined && payload.delivery_date?.trim()) {
    const parsedDate = parseDateInput(payload.delivery_date);
    if (parsedDate) {
      updateData.deliveryDate = parsedDate;
    }
  }
  if (payload.product_specs !== undefined && payload.product_specs?.trim()) {
    updateData.productSpecs = payload.product_specs.trim();
  }
  if (payload.capacity !== undefined) {
    updateData.capacity = payload.capacity;
  }
  if (payload.particle_size !== undefined && payload.particle_size?.trim()) {
    updateData.particleSize = payload.particle_size.trim();
  }
  if (payload.acm_rpm !== undefined) {
    updateData.acmRpm = payload.acm_rpm;
  }
  if (payload.classifier_rpm !== undefined) {
    updateData.classifierRpm = payload.classifier_rpm;
  }
  if (payload.blower_rpm !== undefined) {
    updateData.blowerRpm = payload.blower_rpm;
  }
  if (payload.raw_materials !== undefined && payload.raw_materials?.trim()) {
    updateData.rawMaterials = payload.raw_materials.trim();
  }
  if (payload.remarks !== undefined) {
    updateData.remarks = payload.remarks?.trim() || null;
  }
  if (payload.status !== undefined) {
    updateData.status = payload.status;
  }
  if (payload.state !== undefined) {
    updateData.state = payload.state?.trim() || null;
  }

  const updatedProduction = await prisma.production.update({
    where: { id: productionId },
    data: updateData,
    select: PRODUCTION_LIST_SELECT
  });

  await recordAuditEvent({
    action: "UPDATE_PRODUCTION",
    entityType: "Production",
    entityId: productionId,
    user: actorUser,
    oldValue: production,
    newValue: updatedProduction,
    note: `Updated production #${productionId}`
  });

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

  return { id: productionId };
}
