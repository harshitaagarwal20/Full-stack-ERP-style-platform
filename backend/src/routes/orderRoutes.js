import { Router } from "express";
import { addOrder, editOrder, getOrders, removeOrder, updateOrderStatus } from "../controllers/orderController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createOrderSchema, moveOrderToProductionSchema, updateOrderSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);
router.get("/", allowRoles("admin", "sales"), getOrders);
router.post("/", allowRoles("admin", "sales"), validateBody(createOrderSchema), addOrder);
router.put("/:id", allowRoles("admin", "sales"), validateBody(updateOrderSchema), editOrder);
router.delete("/:id", allowRoles("admin", "sales"), removeOrder);
router.put("/:id/status", allowRoles("admin", "sales"), validateBody(moveOrderToProductionSchema), updateOrderStatus);

export default router;

