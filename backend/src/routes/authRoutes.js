import { Router } from "express";
import { login } from "../controllers/authController.js";
import { validateBody } from "../middleware/validateMiddleware.js";
import { loginSchema } from "../utils/validators.js";

const router = Router();

router.post("/login", validateBody(loginSchema), login);

export default router;
