import { Router } from "express";
import {
  addManualOrderRequest,
  getManualOrderRequests,
  setManualOrderDate,
  updateManualOrderRequest
} from "../controllers/manualOrderRequestController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  createManualOrderRequestSchema,
  setManualOrderRequestDispatchDateSchema,
  updateManualOrderRequestStatusSchema
} from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "dispatch"), getManualOrderRequests);
router.post("/", allowRoles("admin", "sales"), validateBody(createManualOrderRequestSchema), addManualOrderRequest);
router.put("/:id/status", allowRoles("admin"), validateBody(updateManualOrderRequestStatusSchema), updateManualOrderRequest);
router.put("/:id/dispatch-date", allowRoles("admin", "dispatch"), validateBody(setManualOrderRequestDispatchDateSchema), setManualOrderDate);

export default router;
