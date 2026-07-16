import { Router } from "express";
import {
  addDispatch,
  editDispatch,
  getDispatch,
  removeDispatch,
  setManualOrderDispatchDateOnDispatchPage,
  setOrderDispatchDate
} from "../controllers/dispatchController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createDispatchSchema, updateDispatchSchema, updateOrderDispatchDateSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const dispatchAccess = requirePermission("dispatch");

router.use(authMiddleware);
router.get("/", dispatchAccess, getDispatch);
router.put(
  "/dispatch-date/:enquiryId",
  dispatchAccess,
  validateBody(updateOrderDispatchDateSchema),
  setOrderDispatchDate
);
router.put(
  "/dispatch-date/manual/:requestId",
  dispatchAccess,
  validateBody(updateOrderDispatchDateSchema),
  setManualOrderDispatchDateOnDispatchPage
);
router.post("/", dispatchAccess, validateBody(createDispatchSchema), addDispatch);
router.put("/:id", dispatchAccess, validateBody(updateDispatchSchema), editDispatch);
router.delete("/:id", dispatchAccess, removeDispatch);

export default router;
