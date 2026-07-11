import { Router } from "express";
import { deleteBOMHandler, getBOMHandler, importBOMHandler, listBOMsHandler, lookupBOMHandler, saveBOMHandler } from "../controllers/bomController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { importBomSchema, saveBomSchema } from "../utils/validators.js";

const router = Router();
router.use(authMiddleware);

router.get("/",        allowRoles("admin", "production"), listBOMsHandler);
router.get("/lookup",  allowRoles("admin", "production"), lookupBOMHandler);
router.get("/:id",     allowRoles("admin", "production"), getBOMHandler);
router.post("/",       allowRoles("admin"), validateBody(saveBomSchema), saveBOMHandler);
router.post("/import", allowRoles("admin"), validateBody(importBomSchema), importBOMHandler);
router.delete("/:id",  allowRoles("admin"), deleteBOMHandler);

export default router;
