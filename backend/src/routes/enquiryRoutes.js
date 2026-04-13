import { Router } from "express";
import { addEnquiry, approveOrRejectEnquiry, editEnquiry, getEnquiries, removeEnquiry } from "../controllers/enquiryController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createEnquirySchema, updateEnquirySchema, updateEnquiryStatusSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), getEnquiries);
router.post("/", allowRoles("admin", "sales"), validateBody(createEnquirySchema), addEnquiry);
router.put("/:id", allowRoles("admin"), validateBody(updateEnquiryStatusSchema), approveOrRejectEnquiry);
router.put("/:id/edit", allowRoles("admin", "sales"), validateBody(updateEnquirySchema), editEnquiry);
router.delete("/:id", allowRoles("admin", "sales"), removeEnquiry);

export default router;

