import {
  createPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
  listSuppliers
} from "../services/poService.js";

export async function listPOs(req, res, next) {
  try {
    const result = await listPurchaseOrders(req.query);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function createPO(req, res, next) {
  try {
    const po = await createPurchaseOrder(req.validatedBody, req.user);
    return res.status(201).json(po);
  } catch (error) {
    return next(error);
  }
}

export async function getPOById(req, res, next) {
  try {
    const po = await getPurchaseOrder(Number(req.params.id));
    return res.json(po);
  } catch (error) {
    return next(error);
  }
}

export async function updatePO(req, res, next) {
  try {
    const po = await updatePurchaseOrder(Number(req.params.id), req.validatedBody, req.user);
    return res.json(po);
  } catch (error) {
    return next(error);
  }
}

export async function updatePOStatus(req, res, next) {
  try {
    const po = await updatePurchaseOrderStatus(
      Number(req.params.id),
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
    const result = await deletePurchaseOrder(Number(req.params.id), req.user);
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
    return next(error);
  }
}
