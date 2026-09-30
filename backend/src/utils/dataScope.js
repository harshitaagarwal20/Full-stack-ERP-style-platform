import prisma from "../config/prisma.js";

// A user's data scope decides whose records the sales-side lists show them:
// ALL (everyone's) or SELF (only what they raised). Admins always see all, so
// a bad edit on the users screen can never hide data from the people fixing it.
export function scopedOwnerId(user) {
  if (!user || user.role === "admin") return null;
  return user.dataScope === "SELF" ? user.id : null;
}

// Orders count as a user's own when they placed them directly, or when they
// came from that user's enquiry or manual order request (the order row itself
// is stamped with whoever approved it).
export function orderOwnerWhere(ownerId) {
  return {
    OR: [
      { createdById: ownerId },
      { enquiry: { createdById: ownerId } },
      { manualOrderRequest: { createdById: ownerId } }
    ]
  };
}

// 404 rather than 403 so a SELF user can't probe which ids belong to others.
function notFound(label) {
  const error = new Error(`${label} not found.`);
  error.statusCode = 404;
  return error;
}

export async function assertEnquiryAccess(user, enquiryId) {
  const ownerId = scopedOwnerId(user);
  if (!ownerId) return;
  const found = await prisma.enquiry.findFirst({ where: { id: enquiryId, createdById: ownerId }, select: { id: true } });
  if (!found) throw notFound("Enquiry");
}

export async function assertManualOrderRequestAccess(user, requestId) {
  const ownerId = scopedOwnerId(user);
  if (!ownerId) return;
  const found = await prisma.manualOrderRequest.findFirst({ where: { id: requestId, createdById: ownerId }, select: { id: true } });
  if (!found) throw notFound("Request");
}

export async function assertOrderAccess(user, orderId) {
  const ownerId = scopedOwnerId(user);
  if (!ownerId) return;
  const found = await prisma.order.findFirst({ where: { id: orderId, ...orderOwnerWhere(ownerId) }, select: { id: true } });
  if (!found) throw notFound("Order");
}
