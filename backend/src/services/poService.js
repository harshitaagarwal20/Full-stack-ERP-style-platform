import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { PO_LIST_SELECT, PO_DETAIL_SELECT } from "../utils/selects.js";
import { extractSupplierCodeSequence, formatPONumber, formatSupplierCode } from "../utils/businessNumbers.js";

const PO_CACHE_PREFIX = "purchase-orders:list";
const PO_CACHE_TTL_MS = 12 * 1000;

function invalidatePOCaches() {
  invalidateCacheByPrefix("purchase-orders:");
  invalidateCacheByPrefix("dashboard:");
}

async function findOrCreateSupplier(supplierName, supplierDetails = {}) {
  const name = String(supplierName || "").trim();
  if (!name) {
    const error = new Error("Supplier name is required.");
    error.statusCode = 400;
    throw error;
  }

  const existing = await prisma.supplier.findUnique({ where: { name } });
  const providedSupplierCode = String(supplierDetails.supplier_code || "").trim();
  let generatedSupplierCode = existing?.supplierCode || null;

  if (!providedSupplierCode && !generatedSupplierCode) {
    const supplierCodes = await prisma.supplier.findMany({
      select: { supplierCode: true }
    });
    const maxSequence = supplierCodes.reduce((max, row) => {
      const sequence = extractSupplierCodeSequence(row.supplierCode);
      return sequence > max ? sequence : max;
    }, 0);
    generatedSupplierCode = formatSupplierCode(maxSequence + 1);
  }

  const details = {};
  if (supplierDetails.supplier_code   !== undefined || generatedSupplierCode) details.supplierCode  = providedSupplierCode || generatedSupplierCode;
  if (supplierDetails.contact_person  !== undefined) details.contactPerson = supplierDetails.contact_person  || null;
  if (supplierDetails.email           !== undefined) details.email         = supplierDetails.email           || null;
  if (supplierDetails.phone           !== undefined) details.phone         = supplierDetails.phone           || null;
  if (supplierDetails.address         !== undefined) details.address       = supplierDetails.address         || null;
  if (supplierDetails.pincode         !== undefined) details.pincode       = supplierDetails.pincode         || null;
  if (supplierDetails.gst_no          !== undefined) details.gstNo         = supplierDetails.gst_no          || null;
  if (supplierDetails.pan_no          !== undefined) details.panNo         = supplierDetails.pan_no          || null;

  if (existing) {
    return prisma.supplier.update({
      where: { id: existing.id },
      data: details
    });
  }

  return prisma.supplier.create({
    data: { name, ...details }
  });
}

function generateUniqueKey(poId, itemIndex) {
  return `POI-${poId}-${itemIndex}-${Date.now()}`;
}

function buildItemsCreateData(items, poId, supplierName, poNumber) {
  return items.map((item, index) => ({
    uniqueKey: generateUniqueKey(poId, index),
    poNumber,
    supplier: supplierName,
    itemId: String(item.item_description || "").trim(),
    category: item.category || null,
    uom: item.uom || null,
    grade: item.grade || null,
    currency: item.currency || "INR",
    unitPrice: Number(item.unit_price || 0),
    taxPercent: Number(item.tax_percent || 0),
    expDaysDelivery: item.exp_days_delivery || null,
    qty: Number(item.quantity_ordered),
    outwardKey: item.outward_key || null,
    batchNo: item.batch_no || null
  }));
}

export async function createPurchaseOrder(payload, user) {
  const supplier = await findOrCreateSupplier(payload.supplier_name, {
    supplier_code:  payload.supplier_code,
    contact_person: payload.supplier_contact_person,
    email:          payload.supplier_email,
    phone:          payload.supplier_phone,
    address:        payload.supplier_address,
    pincode:        payload.supplier_pincode,
    gst_no:         payload.supplier_gst_no,
    pan_no:         payload.supplier_pan_no
  });

  const totalAmount = payload.items.reduce(
    (sum, item) => sum + Number(item.quantity_ordered) * Number(item.unit_price || 0),
    0
  );

  const tmpKey = `TMP-${Date.now()}`;
  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber: tmpKey,
      poNumberWithCategory: payload.po_number_with_category || null,
      category: payload.category || payload.department || null,
      billTo: payload.bill_to || "NIMBASIA STABILIZERS",
      supplierId: supplier.id,
      orderDate: payload.order_date ? new Date(payload.order_date) : new Date(),
      expectedDeliveryDate: payload.expected_delivery_date ? new Date(payload.expected_delivery_date) : null,
      totalDiscount: payload.total_discount ?? 0,
      freight: payload.freight || null,
      status: "DRAFT",
      totalAmount,
      notes: payload.notes || null,
      department: payload.department || null,
      createdById: user.id
    }
  });

  const poNumber = formatPONumber(po.id);
  const itemsData = buildItemsCreateData(payload.items, po.id, supplier.name, poNumber);

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      poNumber,
      poNumberWithCategory: payload.po_number_with_category || poNumber,
      items: { create: itemsData }
    },
    select: PO_DETAIL_SELECT
  });

  await recordAuditEvent({
    action: "CREATE",
    entityType: "PurchaseOrder",
    entityId: po.id,
    user,
    newValue: { poNumber, supplierId: supplier.id, totalAmount }
  });

  invalidatePOCaches();
  return updated;
}

export async function listPurchaseOrders(query = {}) {
  const { page, limit, skip, take } = buildPagination(query, { defaultLimit: 10, maxLimit: 100 });

  const where = {};

  if (query.status && query.status !== "all") {
    where.status = query.status;
  }

  if (query.supplier) {
    where.supplier = { name: { contains: query.supplier } };
  }

  if (query.date_from || query.date_to) {
    where.orderDate = {};
    if (query.date_from) where.orderDate.gte = new Date(query.date_from);
    if (query.date_to) where.orderDate.lte = new Date(query.date_to);
  }

  if (query.q) {
    where.OR = [
      { poNumber: { contains: query.q } },
      { supplier: { name: { contains: query.q } } }
    ];
  }

  const cacheKey = buildCacheKey(PO_CACHE_PREFIX, query);

  return getOrLoadCached(cacheKey, PO_CACHE_TTL_MS, async () => {
    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        select: PO_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take
      }),
      prisma.purchaseOrder.count({ where })
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

export async function getPurchaseOrder(id) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    select: PO_DETAIL_SELECT
  });

  if (!po) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  return po;
}

export async function updatePurchaseOrder(id, payload, user) {
  const existing = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!existing) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (existing.status !== "DRAFT") {
    const error = new Error("Only DRAFT purchase orders can be edited.");
    error.statusCode = 400;
    throw error;
  }

  let supplierId = existing.supplierId;
  let supplierName = null;

  if (payload.supplier_name) {
    const supplier = await findOrCreateSupplier(payload.supplier_name, {
      supplier_code:  payload.supplier_code,
      contact_person: payload.supplier_contact_person,
      email:          payload.supplier_email,
      phone:          payload.supplier_phone,
      address:        payload.supplier_address,
      pincode:        payload.supplier_pincode,
      gst_no:         payload.supplier_gst_no,
      pan_no:         payload.supplier_pan_no
    });
    supplierId = supplier.id;
    supplierName = supplier.name;
  }

  let totalAmount = existing.totalAmount;
  if (payload.items) {
    totalAmount = payload.items.reduce(
      (sum, item) => sum + Number(item.quantity_ordered) * Number(item.unit_price || 0),
      0
    );
  }

  const resolvedSupplierName = supplierName || (await prisma.supplier.findUnique({ where: { id: supplierId }, select: { name: true } }))?.name || "";

  const updated = await prisma.$transaction(async (tx) => {
    if (payload.items) {
      await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
      const newItems = buildItemsCreateData(payload.items, id, resolvedSupplierName, existing.poNumber);
      await tx.purchaseOrderItem.createMany({ data: newItems.map((item) => ({ ...item, poId: id })) });
    }

    return tx.purchaseOrder.update({
      where: { id },
      data: {
        supplierId,
        category: payload.category !== undefined ? (payload.category || null) : undefined,
        poNumberWithCategory: payload.po_number_with_category !== undefined
          ? (payload.po_number_with_category || null)
          : undefined,
        billTo: payload.bill_to !== undefined ? (payload.bill_to || null) : undefined,
        orderDate: payload.order_date ? new Date(payload.order_date) : undefined,
        expectedDeliveryDate: payload.expected_delivery_date !== undefined
          ? (payload.expected_delivery_date ? new Date(payload.expected_delivery_date) : null)
          : undefined,
        totalDiscount: payload.total_discount !== undefined ? payload.total_discount : undefined,
        freight: payload.freight !== undefined ? (payload.freight || null) : undefined,
        totalAmount,
        notes: payload.notes !== undefined ? payload.notes : undefined,
        department: payload.department !== undefined ? payload.department : undefined
      },
      select: PO_DETAIL_SELECT
    });
  });

  await recordAuditEvent({
    action: "UPDATE",
    entityType: "PurchaseOrder",
    entityId: id,
    user,
    oldValue: { status: existing.status, totalAmount: existing.totalAmount },
    newValue: { totalAmount }
  });

  invalidatePOCaches();
  return updated;
}

const VALID_TRANSITIONS = {
  DRAFT: ["SENT_TO_SUPPLIER"],
  SENT_TO_SUPPLIER: ["PARTIALLY_RECEIVED", "FULLY_RECEIVED"],
  PARTIALLY_RECEIVED: ["FULLY_RECEIVED"],
  FULLY_RECEIVED: ["CLOSED"],
  CLOSED: []
};

export async function updatePurchaseOrderStatus(id, newStatus, user) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!po) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  const allowed = VALID_TRANSITIONS[po.status] || [];
  if (!allowed.includes(newStatus)) {
    const error = new Error(`Cannot transition from ${po.status} to ${newStatus}.`);
    error.statusCode = 400;
    throw error;
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: newStatus },
    select: PO_DETAIL_SELECT
  });

  await recordAuditEvent({
    action: "UPDATE_STATUS",
    entityType: "PurchaseOrder",
    entityId: id,
    user,
    oldValue: { status: po.status },
    newValue: { status: newStatus }
  });

  invalidatePOCaches();
  return updated;
}

export async function deletePurchaseOrder(id, user) {
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });

  if (!po) {
    const error = new Error("Purchase order not found.");
    error.statusCode = 404;
    throw error;
  }

  if (po.status !== "DRAFT") {
    const error = new Error("Only DRAFT purchase orders can be deleted.");
    error.statusCode = 400;
    throw error;
  }

  await prisma.purchaseOrder.delete({ where: { id } });

  await recordAuditEvent({
    action: "DELETE",
    entityType: "PurchaseOrder",
    entityId: id,
    user,
    oldValue: { poNumber: po.poNumber, status: po.status }
  });

  invalidatePOCaches();
  return { id };
}

export async function listSuppliers() {
  return prisma.supplier.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
}
