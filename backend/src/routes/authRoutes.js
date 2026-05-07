import { Router } from "express";
import { login } from "../controllers/authController.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { loginSchema } from "../utils/validators.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Auth API is running. Use POST /api/auth/login to sign in."
  });
});

router.get("/login", (req, res) => {
  res.json({
    ok: true,
    message: "Use POST /api/auth/login with email and password."
  });
});

router.post("/login", validateBody(loginSchema), login);

export default router;
