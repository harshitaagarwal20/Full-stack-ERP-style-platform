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
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createDispatchSchema, updateDispatchSchema, updateOrderDispatchDateSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), getDispatch);
router.put(
  "/dispatch-date/:enquiryId",
  allowRoles("admin", "dispatch"),
  validateBody(updateOrderDispatchDateSchema),
  setOrderDispatchDate
);
router.put(
  "/dispatch-date/manual/:requestId",
  allowRoles("admin", "dispatch"),
  validateBody(updateOrderDispatchDateSchema),
  setManualOrderDispatchDateOnDispatchPage
);
router.post("/", allowRoles("admin", "dispatch"), validateBody(createDispatchSchema), addDispatch);
router.put("/:id", allowRoles("admin", "dispatch"), validateBody(updateDispatchSchema), editDispatch);
router.delete("/:id", allowRoles("admin", "dispatch"), removeDispatch);

export default router;
