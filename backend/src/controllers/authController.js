import { loginUser } from "../services/authService.js";
import { requestPasswordResetOtp, resetPasswordWithOtp } from "../services/userService.js";

export async function forgotPasswordOtp(req, res, next) {
  try {
    const result = await requestPasswordResetOtp(req.validatedBody.email);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    await resetPasswordWithOtp(req.validatedBody.email, req.validatedBody.otp, req.validatedBody.new_password);
    return res.json({ message: "Password reset. You can now log in with your new password." });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.validatedBody.email, req.validatedBody.password);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
