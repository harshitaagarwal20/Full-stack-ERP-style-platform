import { createProduction, deleteProduction, getProductionById, listProductionOrders, markProductionComplete, updateProduction } from "../services/productionService.js";

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
    return next(error);
  }
}

export async function getProductionOrder(req, res, next) {
  try {
    const production = await getProductionById(Number(req.params.id));
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function editProduction(req, res, next) {
  try {
    const production = await updateProduction(Number(req.params.id), req.validatedBody, req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function completeProduction(req, res, next) {
  try {
    const production = await markProductionComplete(Number(req.params.id), req.user, req.validatedBody);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}

export async function removeProduction(req, res, next) {
  try {
    const production = await deleteProduction(Number(req.params.id), req.user);
    return res.json(production);
  } catch (error) {
    return next(error);
  }
}
