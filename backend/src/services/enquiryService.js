import prisma from "../config/prisma.js";
import { recordAuditEvent } from "./auditService.js";
import { buildPagination } from "../utils/pagination.js";
import { ENQUIRY_LIST_SELECT } from "../utils/selects.js";

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

export async function createEnquiry(payload, userId) {
  return prisma.enquiry.create({
    data: {
      enquiryDate: parseDateInput(payload.enquiry_date),
      modeOfEnquiry: payload.mode_of_enquiry || null,
      companyName: payload.company_name,
      product: payload.product,
      quantity: payload.quantity,
      unitOfMeasurement: payload.unit_of_measurement || null,
      expectedTimeline: parseDateInput(payload.expected_timeline),
      assignedPerson: payload.assigned_person,
      notesForProduction: payload.notes_for_production || null,
      remarks: null,
      createdById: userId
    },
    select: ENQUIRY_LIST_SELECT
  });
}

export async function listEnquiries(filters = {}) {
  const { status, q } = filters;
  const { page, take, skip } = buildPagination(filters, { defaultLimit: 0, maxLimit: 100 });

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q } },
            { product: { contains: q } },
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
}

export async function updateEnquiryStatus(enquiryId, status, approvedByUser) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
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
  });

  return updatedEnquiry;
}

export async function updateEnquiry(enquiryId, payload) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true
    }
  });

  if (!enquiry) {
    const error = new Error("Enquiry not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.enquiry.update({
    where: { id: enquiryId },
    data: {
      enquiryDate: payload.enquiry_date ? parseDateInput(payload.enquiry_date) : undefined,
      modeOfEnquiry: payload.mode_of_enquiry,
      companyName: payload.company_name,
      product: payload.product,
      quantity: payload.quantity,
      unitOfMeasurement: payload.unit_of_measurement,
      expectedTimeline: payload.expected_timeline ? parseDateInput(payload.expected_timeline) : undefined,
      assignedPerson: payload.assigned_person,
      notesForProduction: payload.notes_for_production
    },
    select: ENQUIRY_LIST_SELECT
  });
}

export async function deleteEnquiry(enquiryId, actorUser) {
  const enquiry = await prisma.enquiry.findUnique({
    where: { id: enquiryId },
    select: {
      id: true,
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

  return prisma.$transaction(async (tx) => {
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
  });
}
