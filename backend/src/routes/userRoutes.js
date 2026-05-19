import { Router } from "express";
import { addUser, changeOwnPassword, editUser, getUsers, removeUser } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { changePasswordSchema, createUserSchema, updateUserSchema } from "../utils/validators.js";

const router = Router();

router.use(authMiddleware);

// /me must come before /:id to avoid routing conflict
router.patch("/me/password", validateBody(changePasswordSchema), changeOwnPassword);

router.get("/", allowRoles("admin"), getUsers);
router.post("/", allowRoles("admin"), validateBody(createUserSchema), addUser);
router.put("/:id", allowRoles("admin"), validateBody(updateUserSchema), editUser);
router.delete("/:id", allowRoles("admin"), removeUser);

export default router;
