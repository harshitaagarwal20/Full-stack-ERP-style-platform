import { Router } from "express";
import { addUser, changeOwnPassword, editUser, getUsers, removeUser } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { changePasswordSchema, createUserSchema, updateUserSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const users = requirePermission("users");

router.use(authMiddleware);

// /me must come before /:id to avoid routing conflict
router.patch("/me/password", validateBody(changePasswordSchema), changeOwnPassword);

router.get("/", users, getUsers);
router.post("/", users, validateBody(createUserSchema), addUser);
router.put("/:id", users, validateBody(updateUserSchema), editUser);
router.delete("/:id", users, removeUser);

export default router;
