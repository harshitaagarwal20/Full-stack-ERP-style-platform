import { createProduction, deleteProduction, getProductionById, listBatchSubstitutions, listProductionOrders, markProductionComplete, saveFinishedGoodsTestSheet, saveInProcessTestSheet, substituteProductionBatch, updateProduction } from "../services/productionService.js";
import { emptyPaginatedOrArrayFallback, isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

export async function addProduction(req, res, next) {
  try {
    const production = await createProduction(req.validatedBody, req.user);
    return res.status(201).json(production);
  } catch (error) {
    return next(error);
  }
}

export async function getProductionOrders(req, res, next) {
  try {
    const records = await listProductionOrders(req.query);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.json(records);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json(emptyPaginatedOrArrayFallback(req));
    }
    return next(error);
  }
}

export async function getProductionOrder(req, res, next) {
  try {
    const production = await getProductionById(toPositiveIntOrThrow(req.params.id, "id"));
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function editProduction(req, res, next) {
  try {
    const production = await updateProduction(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function completeProduction(req, res, next) {
  try {
    const production = await markProductionComplete(toPositiveIntOrThrow(req.params.id, "id"), req.user, req.validatedBody);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function saveFinishedGoodsTestSheetHandler(req, res, next) {
  try {
    const production = await saveFinishedGoodsTestSheet(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function saveInProcessTestSheetHandler(req, res, next) {
  try {
    const production = await saveInProcessTestSheet(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function substituteProductionBatchHandler(req, res, next) {
  try {
    const result = await substituteProductionBatch(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

export async function listBatchSubstitutionsHandler(req, res, next) {
  try {
    const substitutions = await listBatchSubstitutions(toPositiveIntOrThrow(req.params.id, "id"));
    return res.json(substitutions);
  } catch (error) {
    return next(error);
  }
}

export async function removeProduction(req, res, next) {
  try {
    const production = await deleteProduction(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}
