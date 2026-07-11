import { createEnquiry, deleteEnquiry, listEnquiries, updateEnquiry, updateEnquiryStatus } from "../services/enquiryService.js";
import { emptyPaginatedOrArrayFallback, isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

export async function getEnquiries(req, res, next) {
  try {
    const enquiries = await listEnquiries(req.query);
    res.setHeader("Cache-Control", "private, max-age=10");

    return res.json(enquiries);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json(emptyPaginatedOrArrayFallback(req));
    }
    return next(error);
  }
}

export async function addEnquiry(req, res, next) {
  try {
    const enquiry = await createEnquiry(req.validatedBody, req.user);
    return res.status(201).json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function editEnquiry(req, res, next) {
  try {
    const enquiry = await updateEnquiry(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody);
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function removeEnquiry(req, res, next) {
  try {
    const enquiry = await deleteEnquiry(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function approveOrRejectEnquiry(req, res, next) {
  try {
    const enquiry = await updateEnquiryStatus(
      toPositiveIntOrThrow(req.params.id, "id"),
      req.validatedBody.status,
      req.user,
      req.validatedBody.rejection_reason
    );
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}
