import { Router } from "express";
import { confirmGRNHandler, createGRNHandler, getGRNHandler, listGRNsHandler, rejectGRNHandler, saveQcTestSheetHandler } from "../controllers/grnController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createGRNSchema, rejectGrnSchema, saveQcTestSheetSchema } from "../utils/validators.js";

const router = Router();
router.use(authMiddleware);

// Reads need VIEW on "grns", writes need FULL. By default the purchasing roles
// are granted VIEW — they can follow what has landed against their POs, while
// receiving goods and signing off QC stays with admin. An admin can widen that
// on the Role Management screen.
const grns = requirePermission("grns");

router.get("/",             grns, listGRNsHandler);
router.post("/",            grns, validateBody(createGRNSchema), createGRNHandler);
router.get("/:id",          grns, getGRNHandler);
router.post("/:id/qc",      grns, validateBody(saveQcTestSheetSchema), saveQcTestSheetHandler);
router.post("/:id/confirm", grns, confirmGRNHandler);
// A consignment that failed its raw material test is turned away here.
router.post("/:id/reject",  grns, validateBody(rejectGrnSchema), rejectGRNHandler);

export default router;
