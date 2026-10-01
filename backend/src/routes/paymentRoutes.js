import { Router } from "express";
import { getAgingReportHandler } from "../controllers/orderController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = Router();

router.use(authMiddleware);
// Invoice-wise received vs pending, aged from the invoice date.
router.get("/aging", requirePermission("payments"), getAgingReportHandler);

export default router;
