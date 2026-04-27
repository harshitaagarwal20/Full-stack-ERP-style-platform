import {
  createDispatch,
  deleteDispatch,
  getDispatchDashboard,
  updateDispatch,
  updateOrderDispatchDate
} from "../services/dispatchService.js";
import { setManualOrderDispatchDate } from "../services/manualOrderRequestService.js";

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
    res.setHeader("Cache-Control", "private, max-age=10");
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

export async function setOrderDispatchDate(req, res, next) {
  try {
    const enquiryId = toPositiveIntOrThrow(req.params.enquiryId, "enquiry id");
    const order = await updateOrderDispatchDate(enquiryId, req.validatedBody, req.user);
    return res.json(order);
  } catch (error) {
    return next(error);
  }
}

export async function setManualOrderDispatchDateOnDispatchPage(req, res, next) {
  try {
    const requestId = toPositiveIntOrThrow(req.params.requestId, "manual order request id");
    const result = await setManualOrderDispatchDate(requestId, req.validatedBody, req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
