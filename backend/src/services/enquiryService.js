import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";
import { ENQUIRY_LIST_SELECT } from "../utils/selects.js";
import { formatEnquiryProducts, normalizeEnquiryProductRows } from "../utils/enquiryProducts.js";
import { ensureProductsExist } from "../utils/productCatalog.js";
import { formatEnquiryNumber } from "../utils/businessNumbers.js";
import { normalizeCurrencyInput, normalizePriceInput } from "../utils/commerce.js";

const ENQUIRY_CACHE_PREFIX = "enquiries:list";
const ENQUIRY_CACHE_TTL_MS = 12 * 1000;
const ENQUIRY_TRANSACTION_OPTIONS = {
  maxWait: 5000,
  timeout: 15000
};

function invalidateEnquiryReadCaches() {
  invalidateCacheByPrefix("enquiries:");
  invalidateCacheByPrefix("dispatch:");
  invalidateCacheByPrefix("dashboard:");
}

function parseDateInput(value) {
  if (!value) return null;
  const trimmed = String(value).trim();

  const ddmmyyyyMatch = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, dd, mm, yyyy] = ddmmyyyyMatch;
    const parsedDdmmyyyy = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    if (!Number.isNaN(parsedDdmmyyyy.getTime())) return parsedDdmmyyyy;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function parseRowQuantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function deriveUnitOfMeasurement(rows, fallback = null) {
  const units = rows
    .map((row) => String(row.unit_of_measurement || "").trim())
    .filter(Boolean);

  if (!units.length) return fallback || null;
  const firstUnit = units[0];
  return units.every((unit) => unit === firstUnit) ? firstUnit : fallback || null;
}

export function buildEnquiryRowData({
  row,
  enquiryNumber,
  sharedData,
  createdById,
  approvedById,
  status
}) {
  return {
    enquiryNumber,
    enquiryDate: sharedData.enquiryDate,
    modeOfEnquiry: sharedData.modeOfEnquiry,
    companyName: sharedData.companyName,
    product: formatEnquiryProducts([row]),
    products: [row],
    quantity: parseRowQuantity(row.quantity),
    price: sharedData.price,
    currency: sharedData.currency,
    unitOfMeasurement: row.unit_of_measurement || deriveUnitOfMeasurement([row], sharedData.unitOfMeasurement || null),
    expectedTimeline: sharedData.expectedTimeline,
    assignedPerson: sharedData.assignedPerson,
    notesForProduction: sharedData.notesForProduction,
    remarks: sharedData.remarks,
    status,
    createdById,
    ...(approvedById ? { approvedById } : {})
  };
}

export async function createEnquiry(payload, userId) {
  const productRows = normalizeEnquiryProductRows(payload.products ?? payload.product);
  const products = await ensureProductsExist(productRows);
  const price = normalizePriceInput(payload.price);
  const currency = normalizeCurrencyInput(payload.currency);
  const normalizedProducts = products.map((product, index) => ({
    product,
    grade: productRows[index]?.grade || "",
    quantity: parseRowQuantity(productRows[index]?.quantity),
    unit_of_measurement: String(productRows[index]?.unit_of_measurement || "").trim()
  }));
  const created = await prisma.$transaction(async (tx) => {
    const createdRows = [];
    let enquiryNumber = null;

    for (const [index, row] of normalizedProducts.entries()) {
      const rowSummary = formatEnquiryProducts([row]);
      const createdRow = await tx.enquiry.create({
        data: {
          enquiryNumber,
          enquiryDate: parseDateInput(payload.enquiry_date),
          modeOfEnquiry: payload.mode_of_enquiry || null,
          companyName: payload.company_name,
          product: rowSummary,
          products: [row],
          quantity: parseRowQuantity(row.quantity),
          price,
          currency,
          unitOfMeasurement: row.unit_of_measurement || deriveUnitOfMeasurement([row], payload.unit_of_measurement || null),
          expectedTimeline: parseDateInput(payload.expected_timeline),
          assignedPerson: payload.assigned_person,
          notesForProduction: payload.notes_for_production || null,
          remarks: null,
          createdById: userId
        },
        select: ENQUIRY_LIST_SELECT
      });

      if (index === 0) {
        enquiryNumber = formatEnquiryNumber(createdRow.id);
        const updatedRow = await tx.enquiry.update({
          where: { id: createdRow.id },
          data: { enquiryNumber },
          select: ENQUIRY_LIST_SELECT
        });
        createdRows.push(updatedRow);
        continue;
      }

      if (enquiryNumber) {
        const updatedRow = await tx.enquiry.update({
          where: { id: createdRow.id },
          data: { enquiryNumber },
          select: ENQUIRY_LIST_SELECT
        });
        createdRows.push(updatedRow);
        continue;
      }

      createdRows.push(createdRow);
    }

    return createdRows.length === 1 ? createdRows[0] : createdRows;
  }, ENQUIRY_TRANSACTION_OPTIONS);
  invalidateEnquiryReadCaches();
  return created;
}

export async function listEnquiries(filters = {}) {
  const { status, q, assigned, date } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });
  const normalizedAssigned = String(assigned || "").trim();
  const normalizedDate = String(date || "").trim();
  const dateFrom = normalizedDate ? new Date(`${normalizedDate}T00:00:00.000Z`) : null;
  const dateTo = normalizedDate ? new Date(`${normalizedDate}T23:59:59.999Z`) : null;

  const where = {
    ...(status ? { status } : {}),
    ...(normalizedAssigned ? { assignedPerson: { contains: normalizedAssigned } } : {}),
    ...(normalizedDate && dateFrom && dateTo ? { expectedTimeline: { gte: dateFrom, lte: dateTo } } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q } },
            { product: { contains: q } },
            { enquiryNumber: { contains: q } },
            { assignedPerson: { contains: q } }
          ]
        }
      : {})
  };

  const query = {
    where,
    select: ENQUIRY_LIST_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  };

  const cacheKey = buildCacheKey(ENQUIRY_CACHE_PREFIX, {
    status: status || null,
    q: q || null,
    assigned: normalizedAssigned || null,
    date: normalizedDate || null,
    page,
    take,
    skip
  });

  return getOrLoadCached(cacheKey, ENQUIRY_CACHE_TTL_MS, async () => {
    if (take > 0) {
      const [items, total] = await Promise.all([
        prisma.enquiry.findMany({
          ...query,
          skip,
          take
        }),
        prisma.enquiry.count({ where })
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

    return prisma.enquiry.findMany(query);
  });
}

export async function updateEnquiryStatus(enquiryId, status, approvedByUser) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      enquiryNumber: true,
      status: true,
      expectedTimeline: true,
      product: true,
      quantity: true,
      companyName: true,
      approvedById: true,
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

  if (enquiry.status !== "PENDING") {
    const error = new Error("Status update is allowed only once.");
    error.statusCode = 400;
    throw error;
  }

  const updatedEnquiry = await prisma.$transaction(async (tx) => {
    await tx.enquiry.update({
      where: { id: enquiryId },
      data: {
        status,
        approvedById: approvedByUser.id
      }
    });

    await recordAuditEvent({
      tx,
      action: status === "ACCEPTED" ? "APPROVE_ENQUIRY" : "REJECT_ENQUIRY",
      entityType: "Enquiry",
      entityId: enquiryId,
      user: approvedByUser,
      oldValue: {
        status: "PENDING",
        approvedById: enquiry.approvedById
      },
      newValue: {
        status,
        approvedById: approvedByUser.id,
        orderCreated: false
      },
      note: `${status === "ACCEPTED" ? "Approved" : "Rejected"} enquiry #${enquiryId}`
    });

    return tx.enquiry.findUnique({
      where: { id: enquiryId },
      select: ENQUIRY_LIST_SELECT
    });
  }, ENQUIRY_TRANSACTION_OPTIONS);

  invalidateEnquiryReadCaches();
  return updatedEnquiry;
}

export async function updateEnquiry(enquiryId, payload) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      enquiryNumber: true,
      companyName: true,
      product: true,
      products: true,
      quantity: true,
      price: true,
      currency: true,
      unitOfMeasurement: true,
      enquiryDate: true,
      modeOfEnquiry: true,
      expectedTimeline: true,
      assignedPerson: true,
      notesForProduction: true,
      remarks: true,
      status: true,
      createdById: true,
      approvedById: true,
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

  const products = payload.products !== undefined || payload.product !== undefined
    ? normalizeEnquiryProductRows(payload.products ?? payload.product)
    : undefined;
  const validProducts = products ? await ensureProductsExist(products, { allowEmpty: false }) : undefined;
  const normalizedProducts = validProducts
    ? validProducts.map((product, index) => ({
        product,
        grade: products[index]?.grade || "",
        quantity: parseRowQuantity(products[index]?.quantity),
        unit_of_measurement: String(products[index]?.unit_of_measurement || "").trim()
      }))
    : undefined;
  const totalQuantity = normalizedProducts?.reduce((sum, row) => sum + parseRowQuantity(row.quantity), 0);

  if (normalizedProducts && normalizedProducts.length > 1) {
    if (enquiry.order) {
      const error = new Error("Cannot split an enquiry with a linked order.");
      error.statusCode = 409;
      throw error;
    }

    const sharedData = {
      enquiryDate: payload.enquiry_date ? parseDateInput(payload.enquiry_date) : enquiry.enquiryDate || null,
      modeOfEnquiry: payload.mode_of_enquiry !== undefined ? (payload.mode_of_enquiry || null) : enquiry.modeOfEnquiry || null,
      companyName: payload.company_name || enquiry.companyName,
      price: payload.price !== undefined ? normalizePriceInput(payload.price) : enquiry.price ?? null,
      currency: payload.currency !== undefined ? normalizeCurrencyInput(payload.currency) : enquiry.currency ?? null,
      expectedTimeline: payload.expected_timeline ? parseDateInput(payload.expected_timeline) : enquiry.expectedTimeline || null,
      assignedPerson: payload.assigned_person || enquiry.assignedPerson,
      notesForProduction: payload.notes_for_production !== undefined ? (payload.notes_for_production || null) : enquiry.notesForProduction || null,
      remarks: payload.remarks !== undefined ? (payload.remarks || null) : enquiry.remarks || null,
      unitOfMeasurement: deriveUnitOfMeasurement(normalizedProducts, payload.unit_of_measurement || enquiry.unitOfMeasurement || null)
    };
    const enquiryNumber = enquiry.enquiryNumber || formatEnquiryNumber(enquiry.id);
    const rowPayloads = normalizedProducts.map((row) =>
      buildEnquiryRowData({
        row,
        enquiryNumber,
        sharedData,
        createdById: enquiry.createdById,
        approvedById: enquiry.approvedById,
        status: enquiry.status
      })
    );

    const createdRows = await prisma.$transaction(async (tx) => {
      const rows = [];

      const updatedFirstRow = await tx.enquiry.update({
        where: { id: enquiryId },
        data: rowPayloads[0],
        select: ENQUIRY_LIST_SELECT
      });
      rows.push(updatedFirstRow);

      for (const rowData of rowPayloads.slice(1)) {
        const createdRow = await tx.enquiry.create({
          data: rowData,
          select: ENQUIRY_LIST_SELECT
        });
        rows.push(createdRow);
      }

      return rows;
    }, ENQUIRY_TRANSACTION_OPTIONS);

    invalidateEnquiryReadCaches();
    return createdRows.length === 1 ? createdRows[0] : createdRows;
  }

  const updated = await prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      enquiryDate: payload.enquiry_date ? parseDateInput(payload.enquiry_date) : undefined,
      modeOfEnquiry: payload.mode_of_enquiry,
      companyName: payload.company_name,
      product: normalizedProducts ? formatEnquiryProducts(normalizedProducts) : payload.product,
      products: normalizedProducts,
      quantity: totalQuantity || payload.quantity,
      price: payload.price !== undefined ? normalizePriceInput(payload.price) : undefined,
      currency: payload.currency !== undefined ? normalizeCurrencyInput(payload.currency) : undefined,
      unitOfMeasurement: normalizedProducts ? deriveUnitOfMeasurement(normalizedProducts, payload.unit_of_measurement || null) : payload.unit_of_measurement,
      expectedTimeline: payload.expected_timeline ? parseDateInput(payload.expected_timeline) : undefined,
      assignedPerson: payload.assigned_person,
      notesForProduction: payload.notes_for_production
    },
    select: ENQUIRY_LIST_SELECT
  });
  invalidateEnquiryReadCaches();
  return updated;
}

export async function deleteEnquiry(enquiryId, actorUser) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
      enquiryNumber: true,
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

  if (enquiry.order) {
    const error = new Error("Cannot delete enquiry with linked order.");
    error.statusCode = 400;
    throw error;
  }

  const result = await prisma.$transaction(async (tx) => {
    await recordAuditEvent({
      tx,
      action: "DELETE_ENQUIRY",
      entityType: "Enquiry",
      entityId: enquiryId,
      user: actorUser,
      oldValue: enquiry,
      note: `Deleted enquiry #${enquiryId}`
    });

    await tx.enquiry.delete({ where: { id: enquiryId } });
    return { id: enquiryId };
  }, ENQUIRY_TRANSACTION_OPTIONS);
  invalidateEnquiryReadCaches();
  return result;
}
