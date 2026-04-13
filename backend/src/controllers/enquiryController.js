import { createEnquiry, deleteEnquiry, listEnquiries, updateEnquiry, updateEnquiryStatus } from "../services/enquiryService.js";

export async function getEnquiries(req, res, next) {
  try {
    const enquiries = await listEnquiries(req.query);

    return res.json(enquiries);
  } catch (error) {
    return next(error);
  }
}

export async function addEnquiry(req, res, next) {
  try {
    const enquiry = await createEnquiry(req.validatedBody, req.user.id);
    return res.status(201).json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function editEnquiry(req, res, next) {
  try {
    const enquiry = await updateEnquiry(Number(req.params.id), req.validatedBody);
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function removeEnquiry(req, res, next) {
  try {
    const enquiry = await deleteEnquiry(Number(req.params.id), req.user);
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}

export async function approveOrRejectEnquiry(req, res, next) {
  try {
    const enquiry = await updateEnquiryStatus(Number(req.params.id), req.validatedBody.status, req.user);
    return res.json(enquiry);
  } catch (error) {
    return next(error);
  }
}
