import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const dashboard = requirePermission("dashboard");

router.use(authMiddleware);
router.get("/", dashboard, getDashboard);
router.get("/summary", dashboard, getDashboard);

export default router;
