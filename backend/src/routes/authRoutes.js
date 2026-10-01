import { Router } from "express";
import rateLimit from "express-rate-limit";
import { forgotPasswordOtp, login, resetPassword } from "../controllers/authController.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { forgotPasswordOtpSchema, loginSchema, resetPasswordSchema } from "../utils/validators.js";

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

// Forgot password, signed out. Each OTP request sends an email, so one IP gets
// a handful per window; wrong OTPs are also capped per code in the service.
const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many OTP requests. Please wait a few minutes and try again." }
});
const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Too many attempts. Please wait a few minutes and try again." }
});

router.post("/forgot-password/otp", forgotPasswordRateLimiter, validateBody(forgotPasswordOtpSchema), forgotPasswordOtp);
router.post("/forgot-password/reset", resetPasswordRateLimiter, validateBody(resetPasswordSchema), resetPassword);

export default router;
