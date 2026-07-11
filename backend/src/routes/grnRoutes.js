import { Router } from "express";
import { confirmGRNHandler, createGRNHandler, getGRNHandler, listGRNsHandler, saveQcTestSheetHandler } from "../controllers/grnController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createGRNSchema, saveQcTestSheetSchema } from "../utils/validators.js";

const router = Router();
router.use(authMiddleware);

router.get("/",             allowRoles("admin"), listGRNsHandler);
router.post("/",            allowRoles("admin"), validateBody(createGRNSchema), createGRNHandler);
router.get("/:id",          allowRoles("admin"), getGRNHandler);
router.post("/:id/qc",      allowRoles("admin"), validateBody(saveQcTestSheetSchema), saveQcTestSheetHandler);
router.post("/:id/confirm", allowRoles("admin"), confirmGRNHandler);

export default router;
