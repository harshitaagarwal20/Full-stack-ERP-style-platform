import { Router } from "express";
import { addUser, editUser, getUsers, removeUser } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { createUserSchema, updateUserSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);

router.get("/", allowRoles("admin"), getUsers);
router.post("/", allowRoles("admin"), validateBody(createUserSchema), addUser);
router.put("/:id", allowRoles("admin"), validateBody(updateUserSchema), editUser);
router.delete("/:id", allowRoles("admin"), removeUser);

export default router;
