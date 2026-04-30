import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales"), getDashboard);
router.get("/summary", allowRoles("admin", "sales"), getDashboard);

export default router;
