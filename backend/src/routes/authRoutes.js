import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login } from "../controllers/authController.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { loginSchema } from "../utils/validators.js";

const router = Router();

// Throttle login attempts per IP to slow down credential brute-forcing.
// Successful logins don't count against the limit, so a legitimate user who
// mistypes their password a few times still won't get locked out.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many login attempts. Please try again in a few minutes." }
});

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

router.post("/login", loginRateLimiter, validateBody(loginSchema), login);

export default router;
