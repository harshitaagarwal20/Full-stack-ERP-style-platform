import { createStockAdjustment, getItemBatchOptions, getLatestStockMovementDate, getRawMaterialInventory, getStockRegister, importOpeningStock, listDistinctItemIds } from "../services/inventoryService.js";
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
    const [rows, latestMovementDate] = await Promise.all([
      getStockRegister(req.query.date),
      getLatestStockMovementDate()
    ]);
    res.json({ rows, latestMovementDate });
  } catch (err) {
    if (isMissingTableError(err)) {
      return res.json({ rows: [], latestMovementDate: null });
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

// One opening balance entered in the app rather than via a spreadsheet — the
// material is chosen from a dropdown, so it cannot be misspelled into a phantom
// item the way a typed Excel cell can. Same set-to-target semantics as the
// import, and the "Opening Stock" reference lands it in the register's Opening
// column.
export async function addOpeningStockHandler(req, res, next) {
  try {
    const result = await importOpeningStock([req.validatedBody], req.user, { reference: "Opening Stock Entry" });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}
