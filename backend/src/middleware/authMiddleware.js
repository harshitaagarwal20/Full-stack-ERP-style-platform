import prisma from "../config/prisma.js";
import { verifyToken, signToken } from "../utils/jwt.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";
import { getCachedUser, setCachedUser } from "../utils/authUserCache.js";

// Keep an active user signed in: once a token is past the halfway point of its
// life, hand back a freshly minted one on this response so the client can swap
// it in silently. A user who keeps using the app therefore never hits an
// expired token — only a genuinely idle session runs out the full window.
function maybeRenewToken(res, payload) {
  const { iat, exp } = payload;
  if (!iat || !exp) return;

  const now = Math.floor(Date.now() / 1000);
  const halfLife = (exp - iat) / 2;
  if (exp - now > halfLife) return;

  const renewed = signToken({
    id: payload.id,
    email: payload.email,
    role: payload.role,
    name: payload.name,
    pwc: payload.pwc || 0
  });
  res.setHeader("X-Renewed-Token", renewed);
}

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
    // Skip the per-request database round-trip when this user was authorized
    // moments ago; the cache holds the same shape the query returns.
    let user = getCachedUser(payload.id);
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { ...USER_PUBLIC_SELECT, passwordChangedAt: true }
      });
      if (user) setCachedUser(payload.id, user);
    }

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
    maybeRenewToken(res, payload);
    return next();
  } catch (error) {
    const authError = new Error("Invalid or expired token.");
    authError.statusCode = 401;
    return next(authError);
  }
}
