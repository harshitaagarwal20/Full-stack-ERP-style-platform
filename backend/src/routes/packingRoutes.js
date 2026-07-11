import { Router } from "express";
import { addPackingRecordHandler, listPackingQueueHandler } from "../controllers/packingController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createPackingRecordSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "production", "dispatch"), listPackingQueueHandler);
router.post("/", allowRoles("admin", "production", "dispatch"), validateBody(createPackingRecordSchema), addPackingRecordHandler);

export default router;
