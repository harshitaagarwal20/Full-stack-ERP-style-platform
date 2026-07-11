import { Router } from "express";
import { createAdjustmentHandler, getStockRegisterHandler, importOpeningStockHandler, listItemBatchesHandler, listItemIdsHandler, listRawMaterialsHandler } from "../controllers/inventoryController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { importInventoryOpeningStockSchema, stockAdjustmentSchema } from "../utils/validators.js";

const router = Router();
router.use(authMiddleware);

router.get("/raw-materials", allowRoles("admin", "production"), listRawMaterialsHandler);
router.get("/item-ids", allowRoles("admin", "production"), listItemIdsHandler);
router.get("/item-batches", allowRoles("admin", "production"), listItemBatchesHandler);
router.get("/stock-register", allowRoles("admin", "production"), getStockRegisterHandler);
router.post("/adjustments", allowRoles("admin", "production"), validateBody(stockAdjustmentSchema), createAdjustmentHandler);
router.post("/import", allowRoles("admin", "production"), validateBody(importInventoryOpeningStockSchema), importOpeningStockHandler);

export default router;
