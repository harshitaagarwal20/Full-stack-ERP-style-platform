import { Router } from "express";
import {
  listCustomersHandler,
  getCustomerHandler,
  getCustomerAddressesHandler,
  createCustomerHandler,
  addAddressHandler,
  updateAddressHandler,
  deleteAddressHandler
} from "../controllers/customerController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import {
  createCustomerSchema,
  createCustomerAddressSchema,
  updateCustomerAddressSchema
} from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const customers = requirePermission("customers");

router.use(authMiddleware);

// Customers and their delivery addresses drive sales and dispatch paperwork,
// so reads are open to the roles that consume them, while creating a customer
// or touching an address is a master-data change: sales owns it, admin
// overrides. Production/purchase/accounts must not be able to edit it.

router.get("/", customers, listCustomersHandler);
router.post("/", customers, validateBody(createCustomerSchema), createCustomerHandler);
router.get("/:id", customers, getCustomerHandler);

// Customer address endpoints — /addresses/:id must be declared before the
// parameterised /:customerId/addresses routes cannot shadow it (distinct
// shapes here, but keep the specific literal path first as a convention).
router.patch("/addresses/:id", customers, validateBody(updateCustomerAddressSchema), updateAddressHandler);
router.delete("/addresses/:id", customers, deleteAddressHandler);

router.get("/:customerId/addresses", customers, getCustomerAddressesHandler);
router.post("/:customerId/addresses", customers, validateBody(createCustomerAddressSchema), addAddressHandler);

export default router;
