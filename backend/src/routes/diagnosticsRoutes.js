import { Router } from "express";
import { mysqlDiagnostics } from "../controllers/diagnosticsController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.get("/mysql", allowRoles("admin"), mysqlDiagnostics);

export default router;
