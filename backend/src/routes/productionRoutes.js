import { Router } from "express";
import { addProduction, completeProduction, editProduction, getProductionOrder, getProductionOrders, listBatchSubstitutionsHandler, removeProduction, saveFinishedGoodsTestSheetHandler, saveInProcessTestSheetHandler, substituteProductionBatchHandler } from "../controllers/productionController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { completeProductionSchema, createProductionSchema, saveFinishedGoodsTestSheetSchema, saveInProcessTestSheetSchema, substituteProductionBatchSchema, updateProductionSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "production"), getProductionOrders);
router.get("/:id", allowRoles("admin", "production"), getProductionOrder);
router.post("/", allowRoles("admin", "production"), validateBody(createProductionSchema), addProduction);
router.put("/:id/edit", allowRoles("admin", "production"), validateBody(updateProductionSchema), editProduction);
router.put("/:id", allowRoles("admin", "production"), validateBody(completeProductionSchema), completeProduction);
router.post("/:id/qc", allowRoles("admin", "production"), validateBody(saveFinishedGoodsTestSheetSchema), saveFinishedGoodsTestSheetHandler);
router.post("/:id/in-process-test", allowRoles("admin", "production"), validateBody(saveInProcessTestSheetSchema), saveInProcessTestSheetHandler);
router.post("/:id/substitute-batch", allowRoles("admin", "production"), validateBody(substituteProductionBatchSchema), substituteProductionBatchHandler);
router.get("/:id/substitutions", allowRoles("admin", "production"), listBatchSubstitutionsHandler);
router.delete("/:id", allowRoles("admin", "production"), removeProduction);

export default router;

