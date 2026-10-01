import { Router } from "express";
import rateLimit from "express-rate-limit";
import { addUser, changeOwnPassword, editUser, getUsers, removeUser, sendPasswordOtp } from "../controllers/userController.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { requirePermission } from "../middleware/permissionMiddleware.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { changePasswordSchema, createUserSchema, requestPasswordOtpSchema, updateUserSchema } from "../utils/validators.js";

const router = Router();

// Module access is configured by an admin on the Role Management screen:
// reads need VIEW, writes need FULL.
const users = requirePermission("users");

// Each OTP request sends an email, so cap how often one IP can ask.
const passwordOtpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please wait a few minutes and try again." }
});

router.use(authMiddleware);

// /me must come before /:id to avoid routing conflict
router.post("/me/password/otp", passwordOtpRateLimiter, validateBody(requestPasswordOtpSchema), sendPasswordOtp);
router.patch("/me/password", validateBody(changePasswordSchema), changeOwnPassword);

router.get("/", users, getUsers);
router.post("/", users, validateBody(createUserSchema), addUser);
router.put("/:id", users, validateBody(updateUserSchema), editUser);
router.delete("/:id", users, removeUser);

export default router;
