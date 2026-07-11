import {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  listSuppliers
} from "../services/poService.js";
import { isMissingTableError } from "../utils/prismaListFallback.js";
import { toPositiveIntOrThrow } from "../utils/routeParams.js";

export async function listPOs(req, res, next) {
  try {
    const result = await listPurchaseOrders(req.query);
    return res.json(result);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.json({ items: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    }
    return next(error);
  }
}

export async function createPO(req, res, next) {
  try {
    const po = await createPurchaseOrder(req.validatedBody, req.user);
    return res.status(201).json(po);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: "Purchase Order module is not yet set up on this server. Please run database migrations." });
    }
    return next(error);
  }
}

export async function getPOById(req, res, next) {
  try {
    const po = await getPurchaseOrder(toPositiveIntOrThrow(req.params.id, "id"));
    return res.json(po);
  } catch (error) {
    return next(error);
  }
}

export async function updatePO(req, res, next) {
  try {
    const po = await updatePurchaseOrder(toPositiveIntOrThrow(req.params.id, "id"), req.validatedBody, req.user);
    return res.json(po);
  } catch (error) {
    if (isMissingTableError(error)) {
      return res.status(503).json({ message: "Purchase Order module is not yet set up on this server. Please run database migrations." });
    }
    return next(error);
  }
}

export async function updatePOStatus(req, res, next) {
  try {
    const po = await updatePurchaseOrderStatus(
      toPositiveIntOrThrow(req.params.id, "id"),
      req.validatedBody.status,
      req.user
    );
    return res.json(po);
  } catch (error) {
    return next(error);
  }
}

export async function deletePO(req, res, next) {
  try {
    const result = await deletePurchaseOrder(toPositiveIntOrThrow(req.params.id, "id"), req.user);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function getSuppliers(req, res, next) {
  try {
    const suppliers = await listSuppliers();
    return res.json(suppliers);
  } catch (error) {
    if (isMissingTableError(error)) return res.json([]);
    return next(error);
  }
}
