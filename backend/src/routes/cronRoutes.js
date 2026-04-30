import { Router } from "express";
import { runAuditRetentionJob } from "../controllers/cronController.js";

const router = Router();

router.get("/audit-retention", runAuditRetentionJob);

export default router;
