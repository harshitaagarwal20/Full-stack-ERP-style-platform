import { deleteBOM, getBOM, importBOMRows, listBOMs, lookupBOM, saveBOM } from "../services/bomService.js";
import { isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

export async function listBOMsHandler(req, res, next) {
  try {
    const data = await listBOMs(req.query);
    return res.json(data);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ items: [] });
    }
    return next(error);
  }
}

export async function getBOMHandler(req, res, next) {
  try {
    const bom = await getBOM(toPositiveIntOrThrow(req.params.id, "id"));
    return res.json(bom);
  } catch (error) {
    return next(error);
  }
}

export async function lookupBOMHandler(req, res, next) {
  try {
    const bom = await lookupBOM(req.query.product, req.query.grade);
    return res.json({ bom });
  } catch (error) {
    return next(error);
  }
}

export async function saveBOMHandler(req, res, next) {
  try {
    const bom = await saveBOM(req.validatedBody, req.user);
    return res.status(201).json(bom);
  } catch (error) {
    return next(error);
  }
}

export async function deleteBOMHandler(req, res, next) {
  try {
    const result = await deleteBOM(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function importBOMHandler(req, res, next) {
  try {
    const result = await importBOMRows(req.validatedBody.rows, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}
