import { Router } from "express";
import {
  addDispatch,
  editDispatch,
  getDispatch,
  removeDispatch,
  setOrderExportDate
} from "../controllers/dispatchController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createDispatchSchema, updateDispatchSchema, updateOrderExportDateSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), getDispatch);
router.put(
  "/export-date/:enquiryId",
  allowRoles("admin", "dispatch"),
  validateBody(updateOrderExportDateSchema),
  setOrderExportDate
);
router.post("/", allowRoles("admin", "dispatch"), validateBody(createDispatchSchema), addDispatch);
router.put("/:id", allowRoles("admin", "dispatch"), validateBody(updateDispatchSchema), editDispatch);
router.delete("/:id", allowRoles("admin", "dispatch"), removeDispatch);

export default router;

