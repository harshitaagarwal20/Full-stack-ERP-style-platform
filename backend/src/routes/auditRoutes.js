import { Router } from "express";
import { getAuditLogs } from "../controllers/auditController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin"), getAuditLogs);

export default router;
