import { Router } from "express";
import { deleteBOMHandler, getBOMHandler, importBOMHandler, listBOMsHandler, lookupBOMHandler, saveBOMHandler } from "../controllers/bomController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { importBomSchema, saveBomSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const bom = requirePermission("bom");
router.use(authMiddleware);

router.get("/",        bom, listBOMsHandler);
router.get("/lookup",  bom, lookupBOMHandler);
router.get("/:id",     bom, getBOMHandler);
router.post("/",       bom, validateBody(saveBomSchema), saveBOMHandler);
router.post("/import", bom, validateBody(importBomSchema), importBOMHandler);
router.delete("/:id",  bom, deleteBOMHandler);

export default router;
