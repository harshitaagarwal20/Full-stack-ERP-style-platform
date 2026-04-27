import {
  createManualOrderRequest,
  listManualOrderRequests,
  setManualOrderDispatchDate,
  updateManualOrderRequestStatus
} from "../services/manualOrderRequestService.js";

export async function getManualOrderRequests(req, res, next) {
  try {
    const requests = await listManualOrderRequests(req.query);
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.json(requests);
  } catch (error) {
    return next(error);
  }
}

export async function addManualOrderRequest(req, res, next) {
  try {
    const request = await createManualOrderRequest(req.validatedBody, req.user);
    return res.status(201).json(request);
  } catch (error) {
    return next(error);
  }
}

export async function updateManualOrderRequest(req, res, next) {
  try {
    const request = await updateManualOrderRequestStatus(Number(req.params.id), req.validatedBody.status, req.user);
    return res.json(request);
  } catch (error) {
    return next(error);
  }
}

export async function setManualOrderDate(req, res, next) {
  try {
    const result = await setManualOrderDispatchDate(Number(req.params.id), req.validatedBody, req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
