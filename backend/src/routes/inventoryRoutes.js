import { Router } from "express";
import { listRawMaterialsHandler } from "../controllers/inventoryController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = Router();
router.use(authMiddleware);

router.get("/raw-materials", allowRoles("admin", "production"), listRawMaterialsHandler);

export default router;
