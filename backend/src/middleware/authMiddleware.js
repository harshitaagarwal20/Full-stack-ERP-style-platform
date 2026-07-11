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
      select: { ...USER_PUBLIC_SELECT, passwordChangedAt: true }
    });

    if (!user) {
      const error = new Error("Account no longer exists. Please sign in again.");
      error.statusCode = 401;
      return next(error);
    }

    const currentPwc = user.passwordChangedAt ? user.passwordChangedAt.getTime() : 0;
    if (currentPwc !== Number(payload.pwc || 0)) {
      const error = new Error("Your password has changed. Please sign in again.");
      error.statusCode = 401;
      return next(error);
    }

    const { passwordChangedAt, ...publicUser } = user;
    req.user = publicUser;
    return next();
  } catch (error) {
    const authError = new Error("Invalid or expired token.");
    authError.statusCode = 401;
    return next(authError);
  }
}
