import prisma from "../config/prisma.js";
import { verifyToken } from "../utils/jwt.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    const error = new Error("Authorization token missing.");
    error.statusCode = 401;
    return next(error);
  }

  const token = header.split(" ")[1];

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: USER_PUBLIC_SELECT
    });

    if (!user) {
      const error = new Error("Account no longer exists. Please sign in again.");
      error.statusCode = 401;
      return next(error);
    }

    req.user = user;
    return next();
  } catch (error) {
    const authError = new Error("Invalid or expired token.");
    authError.statusCode = 401;
    return next(authError);
  }
}
