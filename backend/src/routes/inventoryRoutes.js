import { Router } from "express";
import { addOpeningStockHandler, createAdjustmentHandler, getStockRegisterHandler, importOpeningStockHandler, listItemBatchesHandler, listItemIdsHandler, listRawMaterialsHandler } from "../controllers/inventoryController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { importInventoryOpeningStockSchema, inventoryOpeningStockRowSchema, stockAdjustmentSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const inventory = requirePermission("inventory");
router.use(authMiddleware);

// Purchasing gets read-only stock visibility — enough to see what is on hand
// before raising or pricing a PO — but cannot move stock.
router.get("/raw-materials", inventory, listRawMaterialsHandler);
router.get("/item-ids", inventory, listItemIdsHandler);
router.get("/item-batches", inventory, listItemBatchesHandler);
router.get("/stock-register", inventory, getStockRegisterHandler);
router.post("/adjustments", inventory, validateBody(stockAdjustmentSchema), createAdjustmentHandler);
router.post("/import", inventory, validateBody(importInventoryOpeningStockSchema), importOpeningStockHandler);
router.post("/opening-stock", inventory, validateBody(inventoryOpeningStockRowSchema), addOpeningStockHandler);

export default router;
