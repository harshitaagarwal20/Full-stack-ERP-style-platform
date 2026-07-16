import { Router } from "express";
import { addPackingRecordHandler, listPackingQueueHandler } from "../controllers/packingController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createPackingRecordSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const packing = requirePermission("packing");

router.use(authMiddleware);
router.get("/", packing, listPackingQueueHandler);
router.post("/", packing, validateBody(createPackingRecordSchema), addPackingRecordHandler);

export default router;
