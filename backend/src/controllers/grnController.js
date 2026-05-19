import { createGRN, listGRNs, getGRN, confirmGRN } from "../services/grnService.js";

export async function listGRNsHandler(req, res, next) {
  try {
    const data = await listGRNs(req.query);
    return res.json(data);
  } catch (error) {
    if (error?.code === "P2021") {
      return res.json({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    }
    return next(error);
  }
}

export async function createGRNHandler(req, res, next) {
  try {
    const grn = await createGRN(req.validatedBody, req.user);
    return res.status(201).json(grn);
  } catch (error) {
    if (error?.code === "P2021") {
      return res.status(503).json({ message: "GRN module is not yet set up on this server. Please run database migrations." });
    }
    return next(error);
  }
}

export async function getGRNHandler(req, res, next) {
  try {
    const grn = await getGRN(Number(req.params.id));
    return res.json(grn);
  } catch (error) {
    return next(error);
  }
}

export async function confirmGRNHandler(req, res, next) {
  try {
    const grn = await confirmGRN(Number(req.params.id), req.user);
    return res.json(grn);
  } catch (error) {
    return next(error);
  }
}
