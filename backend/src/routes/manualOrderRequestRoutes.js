import { Router } from "express";
import {
  addManualOrderRequest,
  getManualOrderRequests,
  setManualOrderDate,
  updateManualOrderRequest
} from "../controllers/manualOrderRequestController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  createManualOrderRequestSchema,
  setManualOrderRequestDispatchDateSchema,
  updateManualOrderRequestStatusSchema
} from "../utils/validators.js";

const router = Router();

// The "manual_orders" module permission decides who reaches this at all. Which
// side of it you act on is business policy and stays in code: sales raises and
// approves the request, dispatch only sets the dispatch date.
const manualOrders = requirePermission("manual_orders");

router.use(authMiddleware);
router.get("/", manualOrders, getManualOrderRequests);
router.post("/", manualOrders, allowRoles("sales"), validateBody(createManualOrderRequestSchema), addManualOrderRequest);
router.put("/:id/status", manualOrders, allowRoles("sales"), validateBody(updateManualOrderRequestStatusSchema), updateManualOrderRequest);
router.put("/:id/dispatch-date", manualOrders, allowRoles("dispatch"), validateBody(setManualOrderRequestDispatchDateSchema), setManualOrderDate);

export default router;
