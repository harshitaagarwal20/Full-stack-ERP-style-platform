import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  updatePOStatusSchema
} from "../utils/validators.js";
import {
  listPOs,
  createPO,
  getPOById,
  updatePO,
  updatePOStatus,
  deletePO,
  getSuppliers
} from "../controllers/poController.js";

const router = Router();

router.use(authMiddleware);

// Reaching the purchasing screens at all is governed by the admin-configured
// "purchase_orders" module permission. On top of that sit two rules that are
// business policy rather than access policy, so they stay in code: pricing and
// release belong to accounts (poService also strips pricing from anyone else),
// and deleting a PO is admin-only.
const purchaseOrders = requirePermission("purchase_orders");

// /suppliers must come BEFORE /:id to avoid being matched as an id
router.get("/suppliers", purchaseOrders, getSuppliers);

router.get("/", purchaseOrders, listPOs);
router.post("/", purchaseOrders, validateBody(createPurchaseOrderSchema), createPO);
router.get("/:id", purchaseOrders, getPOById);
router.put("/:id", purchaseOrders, validateBody(updatePurchaseOrderSchema), updatePO);
// Accounts releases the priced PO to the supplier; the service pins them to
// that single transition. Everything else here is admin.
router.patch("/:id/status", purchaseOrders, allowRoles("accounts"), validateBody(updatePOStatusSchema), updatePOStatus);
router.delete("/:id", purchaseOrders, allowRoles(), deletePO);

export default router;
