import { createStockAdjustment, getItemBatchOptions, getRawMaterialInventory, getStockRegister, importOpeningStock, listDistinctItemIds } from "../services/inventoryService.js";
import { isMissingTableError } from "../utils/prismaListFallback.js";

export async function listRawMaterialsHandler(req, res, next) {
  try {
    const result = await getRawMaterialInventory(req.query);
    res.json(result);
  } catch (err) {
    if (isMissingTableError(err)) {
      return res.json({ items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } });
    }
    next(err);
  }
}

export async function listItemIdsHandler(req, res, next) {
  try {
    const itemIds = await listDistinctItemIds();
    res.json({ itemIds });
  } catch (err) {
    if (isMissingTableError(err)) {
      return res.json({ itemIds: [] });
    }
    next(err);
  }
}

export async function listItemBatchesHandler(req, res, next) {
  try {
    const batches = await getItemBatchOptions(req.query.itemId);
    res.json({ batches });
  } catch (err) {
    if (isMissingTableError(err)) {
      return res.json({ batches: [] });
    }
    next(err);
  }
}

export async function getStockRegisterHandler(req, res, next) {
  try {
    const rows = await getStockRegister(req.query.date);
    res.json({ rows });
  } catch (err) {
    if (isMissingTableError(err)) {
      return res.json({ rows: [] });
    }
    next(err);
  }
}

export async function createAdjustmentHandler(req, res, next) {
  try {
    const transaction = await createStockAdjustment(req.validatedBody, req.user);
    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
}

export async function importOpeningStockHandler(req, res, next) {
  try {
    const result = await importOpeningStock(req.validatedBody.rows, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
