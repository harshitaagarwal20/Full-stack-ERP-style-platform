import { Router } from "express";
import { createCustomerMaster, createEnquiryMaster, createMasterDataValue, importCustomerMaster, listMasterData } from "../controllers/masterDataController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createCustomerMasterSchema, createEnquiryMasterSchema, createMasterDataValueSchema, importCustomerMasterSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), listMasterData);
router.post("/enquiry-master/rows", allowRoles("admin"), validateBody(createEnquiryMasterSchema), createEnquiryMaster);
router.post("/customer-master/rows", allowRoles("admin"), validateBody(createCustomerMasterSchema), createCustomerMaster);
router.post("/customer-master/import", allowRoles("admin"), validateBody(importCustomerMasterSchema), importCustomerMaster);
router.post("/:category", allowRoles("admin"), validateBody(createMasterDataValueSchema), createMasterDataValue);

export default router;
