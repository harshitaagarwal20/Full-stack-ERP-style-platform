import { Router } from "express";
import { createCustomerMaster, createEnquiryMaster, createMasterDataValue, createSupplierMaster, importCustomerMaster, importSupplierMaster, listMasterData, removeCustomerMaster, removeSupplierMaster } from "../controllers/masterDataController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createCustomerMasterSchema, createEnquiryMasterSchema, createMasterDataValueSchema, createSupplierMasterSchema, importCustomerMasterSchema, importSupplierMasterSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales", "production", "dispatch"), listMasterData);
router.post("/enquiry-master/rows", allowRoles("admin"), validateBody(createEnquiryMasterSchema), createEnquiryMaster);
router.post("/customer-master/rows", allowRoles("admin"), validateBody(createCustomerMasterSchema), createCustomerMaster);
router.post("/customer-master/import", allowRoles("admin"), validateBody(importCustomerMasterSchema), importCustomerMaster);
router.delete("/customer-master/rows/:id", allowRoles("admin"), removeCustomerMaster);
router.post("/supplier-master/rows", allowRoles("admin"), validateBody(createSupplierMasterSchema), createSupplierMaster);
router.post("/supplier-master/import", allowRoles("admin"), validateBody(importSupplierMasterSchema), importSupplierMaster);
router.delete("/supplier-master/rows/:id", allowRoles("admin"), removeSupplierMaster);
router.post("/:category", allowRoles("admin"), validateBody(createMasterDataValueSchema), createMasterDataValue);

export default router;
