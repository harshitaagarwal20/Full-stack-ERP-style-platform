import {
  createDispatch,
  deleteDispatch,
  getDispatchDashboard,
  updateDispatch,
  updateOrderExportDate
} from "../services/dispatchService.js";

function toPositiveIntOrThrow(rawValue, fieldLabel) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    const error = new Error(`Invalid ${fieldLabel}.`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

export async function getDispatch(req, res, next) {
  try {
    const data = await getDispatchDashboard(req.query);
    return res.json(data);
  } catch (error) {
    return next(error);
  }
}

export async function addDispatch(req, res, next) {
  try {
    const dispatch = await createDispatch(req.validatedBody, req.user);
    return res.status(201).json(dispatch);
  } catch (error) {
    return next(error);
  }
}

export async function editDispatch(req, res, next) {
  try {
    const dispatchId = toPositiveIntOrThrow(req.params.id, "dispatch id");
    const dispatch = await updateDispatch(dispatchId, req.validatedBody, req.user);
    return res.json(dispatch);
  } catch (error) {
    return next(error);
  }
}

export async function removeDispatch(req, res, next) {
  try {
    const dispatchId = toPositiveIntOrThrow(req.params.id, "dispatch id");
    const dispatch = await deleteDispatch(dispatchId, req.user);
    return res.json(dispatch);
  } catch (error) {
    return next(error);
  }
}

export async function setOrderExportDate(req, res, next) {
  try {
    const enquiryId = toPositiveIntOrThrow(req.params.enquiryId, "enquiry id");
    const order = await updateOrderExportDate(enquiryId, req.validatedBody, req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}
