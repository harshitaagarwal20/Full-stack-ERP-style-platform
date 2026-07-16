import { Router } from "express";
import { addEnquiry, approveOrRejectEnquiry, editEnquiry, getEnquiries, removeEnquiry } from "../controllers/enquiryController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createEnquirySchema, updateEnquirySchema, updateEnquiryStatusSchema } from "../utils/validators.js";

const router = Router();

// Access is whatever an admin has granted this role for the "enquiries" module:
// VIEW for the reads, FULL for the writes.
const enquiries = requirePermission("enquiries");

router.use(authMiddleware);
router.get("/", enquiries, getEnquiries);
router.post("/", enquiries, validateBody(createEnquirySchema), addEnquiry);
router.put("/:id", enquiries, validateBody(updateEnquiryStatusSchema), approveOrRejectEnquiry);
router.put("/:id/edit", enquiries, validateBody(updateEnquirySchema), editEnquiry);
router.delete("/:id", enquiries, removeEnquiry);

export default router;

