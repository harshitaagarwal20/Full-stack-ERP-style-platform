import { createGRN, listGRNs, getGRN, confirmGRN, saveQcTestSheet } from "../services/grnService.js";
import { isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

export async function listGRNsHandler(req, res, next) {
  try {
    const data = await listGRNs(req.query);
    return res.json(data);
  } catch (error) {
    if (isMissingTableError(error)) {
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
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: "GRN module is not yet set up on this server. Please run database migrations." });
    }
    return next(error);
  }
}

export async function getGRNHandler(req, res, next) {
  try {
    const grn = await getGRN(toPositiveIntOrThrow(req.params.id, "id"));
    return res.json(grn);
  } catch (error) {
    return next(error);
  }
}

export async function confirmGRNHandler(req, res, next) {
  try {
    const grn = await confirmGRN(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(grn);
  } catch (error) {
    return next(error);
  }
}

export async function saveQcTestSheetHandler(req, res, next) {
  try {
    const grn = await saveQcTestSheet(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(grn);
  } catch (error) {
    return next(error);
  }
}
