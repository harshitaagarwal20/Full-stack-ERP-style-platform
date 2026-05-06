import { Router } from "express";
import { mysqlDiagnostics } from "../controllers/diagnosticsController.js";

const router = Router();

router.get("/mysql", mysqlDiagnostics);

export default router;
