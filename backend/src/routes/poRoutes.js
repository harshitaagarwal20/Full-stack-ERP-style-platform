import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePOStatusSchema
} from "../utils/validators.js";
import {
  listPOs,
  createPO,
  getPOById,
  updatePO,
  updatePOStatus,
  deletePO,
  getSuppliers
} from "../controllers/poController.js";

const router = Router();

router.use(authMiddleware);

// /suppliers must come BEFORE /:id to avoid being matched as an id
router.get("/suppliers", allowRoles("admin", "production"), getSuppliers);

router.get("/", allowRoles("admin", "production"), listPOs);
router.post("/", allowRoles("admin", "production"), validateBody(createPurchaseOrderSchema), createPO);
router.get("/:id", allowRoles("admin", "production"), getPOById);
router.put("/:id", allowRoles("admin", "production"), validateBody(updatePurchaseOrderSchema), updatePO);
router.patch("/:id/status", allowRoles("admin"), validateBody(updatePOStatusSchema), updatePOStatus);
router.delete("/:id", allowRoles("admin"), deletePO);

export default router;
