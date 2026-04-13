import { Router } from "express";
import { addProduction, completeProduction, editProduction, getProductionOrders, removeProduction } from "../controllers/productionController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { completeProductionSchema, createProductionSchema, updateProductionSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), getProductionOrders);
router.post("/", allowRoles("admin", "production"), validateBody(createProductionSchema), addProduction);
router.put("/:id/edit", allowRoles("admin", "production"), validateBody(updateProductionSchema), editProduction);
router.put("/:id", allowRoles("admin", "production"), validateBody(completeProductionSchema), completeProduction);
router.delete("/:id", allowRoles("admin", "production"), removeProduction);

export default router;

