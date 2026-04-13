import { loginUser } from "../services/authService.js";

export async function login(req, res, next) {
  try {
    const result = await loginUser(req.validatedBody.email, req.validatedBody.password);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}
