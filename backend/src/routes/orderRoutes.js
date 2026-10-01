import { Router } from "express";
import { addOrder, editOrder, getOrders, removeOrder, updateOrderStatus, getOrderInvoices, addOrderPayment, removeOrderPayment } from "../controllers/orderController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createOrderSchema, moveOrderToProductionSchema, recordPaymentSchema, updateOrderSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const orders = requirePermission("orders");

router.use(authMiddleware);
router.get("/", orders, getOrders);
router.post("/", orders, validateBody(createOrderSchema), addOrder);
router.put("/:id", orders, validateBody(updateOrderSchema), editOrder);
router.delete("/:id", orders, removeOrder);
router.put("/:id/status", orders, validateBody(moveOrderToProductionSchema), updateOrderStatus);
// Payment is the accounts department's step, gated on its own module; the
// service enforces that only accounts/admin may actually book a receipt.
// Receipts are booked against an invoice (a dispatch) of the order.
const payments = requirePermission("payments");
router.get("/:id/invoices", payments, getOrderInvoices);
router.post("/:id/payments", payments, validateBody(recordPaymentSchema), addOrderPayment);
router.delete("/:id/payments/:paymentId", payments, removeOrderPayment);

export default router;

