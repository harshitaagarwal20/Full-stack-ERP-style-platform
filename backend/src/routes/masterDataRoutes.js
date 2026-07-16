import { Router } from "express";
import { createCustomerMaster, createEnquiryMaster, createMasterDataValue, createProductMaster, createSupplierMaster, deleteMasterDataValue, editProductMaster, importCustomerMaster, importProductMaster, importSupplierMaster, listEditableCategories, listMasterData, removeCustomerMaster, removeProductMaster, removeSupplierMaster } from "../controllers/masterDataController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createCustomerMasterSchema, createEnquiryMasterSchema, createMasterDataValueSchema, createSupplierMasterSchema, importCustomerMasterSchema, importProductMasterSchema, importSupplierMasterSchema, productMasterSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const masterData = requirePermission("master_data");

router.use(authMiddleware);
router.get("/", masterData, listMasterData);
router.post("/enquiry-master/rows", masterData, validateBody(createEnquiryMasterSchema), createEnquiryMaster);
router.post("/customer-master/rows", masterData, validateBody(createCustomerMasterSchema), createCustomerMaster);
router.post("/customer-master/import", masterData, validateBody(importCustomerMasterSchema), importCustomerMaster);
router.delete("/customer-master/rows/:id", masterData, removeCustomerMaster);
router.post("/supplier-master/rows", masterData, validateBody(createSupplierMasterSchema), createSupplierMaster);
router.post("/supplier-master/import", masterData, validateBody(importSupplierMasterSchema), importSupplierMaster);
router.delete("/supplier-master/rows/:id", masterData, removeSupplierMaster);
router.post("/product-master/rows", masterData, validateBody(productMasterSchema), createProductMaster);
router.post("/product-master/import", masterData, validateBody(importProductMasterSchema), importProductMaster);
router.put("/product-master/rows/:id", masterData, validateBody(productMasterSchema), editProductMaster);
router.delete("/product-master/rows/:id", masterData, removeProductMaster);
// Literal paths must stay ahead of the "/:category" catch-alls below, or
// "editable-categories" would be parsed as a category name.
router.get("/editable-categories", masterData, listEditableCategories);

router.post("/:category", masterData, validateBody(createMasterDataValueSchema), createMasterDataValue);
router.delete("/:category/values/:value", masterData, deleteMasterDataValue);

export default router;
