import { Router } from "express";
import { addProduction, completeProduction, editProduction, getBatchPlan, getProductionOrder, getProductionOrders, listBatchSubstitutionsHandler, planBatches, removeProduction, resumeReworkBatchHandler, saveFinishedGoodsTestSheetHandler, saveInProcessTestSheetHandler, splitProduction, substituteProductionBatchHandler } from "../controllers/productionController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { completeProductionSchema, createProductionSchema, planOrderBatchesSchema, saveFinishedGoodsTestSheetSchema, saveInProcessTestSheetSchema, splitProductionSchema, substituteProductionBatchSchema, updateProductionSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const production = requirePermission("production");

router.use(authMiddleware);
router.get("/", production, getProductionOrders);
// Must come before /:id so "order" isn't parsed as a production id.
router.get("/order/:orderId/batch-plan", production, getBatchPlan);
router.post("/order/:orderId/plan", production, validateBody(planOrderBatchesSchema), planBatches);
router.get("/:id", production, getProductionOrder);
router.post("/", production, validateBody(createProductionSchema), addProduction);
router.put("/:id/edit", production, validateBody(updateProductionSchema), editProduction);
router.put("/:id", production, validateBody(completeProductionSchema), completeProduction);
router.post("/:id/qc", production, validateBody(saveFinishedGoodsTestSheetSchema), saveFinishedGoodsTestSheetHandler);
router.post("/:id/in-process-test", production, validateBody(saveInProcessTestSheetSchema), saveInProcessTestSheetHandler);
router.post("/:id/resume-rework", production, resumeReworkBatchHandler);
router.post("/:id/split", production, validateBody(splitProductionSchema), splitProduction);
router.post("/:id/substitute-batch", production, validateBody(substituteProductionBatchSchema), substituteProductionBatchHandler);
router.get("/:id/substitutions", production, listBatchSubstitutionsHandler);
router.delete("/:id", production, removeProduction);

export default router;

