import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { buildPagination } from "../utils/pagination.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";
import { invalidateCachedUser } from "../utils/authUserCache.js";

export async function listUsers(query = {}) {
  const { page, take, skip } = buildPagination(query, { defaultLimit: 20, maxLimit: 100 });

  if (take > 0) {
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        select: USER_PUBLIC_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      }),
      prisma.user.count()
    ]);

    return {
      items,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take))
      }
    };
  }

  return prisma.user.findMany({
    select: USER_PUBLIC_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });
}

// Accounts are company accounts only. Existing users on other domains keep
// working; the rule applies whenever an address is set or changed.
export const ALLOWED_EMAIL_DOMAIN = "nimbasia.com";

function assertAllowedEmail(email) {
  const domain = String(email || "").trim().toLowerCase().split("@")[1];
  if (domain !== ALLOWED_EMAIL_DOMAIN) {
    const error = new Error(`Users must have an @${ALLOWED_EMAIL_DOMAIN} email address.`);
    error.statusCode = 400;
    throw error;
  }
}

export async function createUser(payload) {
  assertAllowedEmail(payload.email);
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  try {
    return await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        role: payload.role,
        ...(payload.data_scope ? { dataScope: payload.data_scope } : {})
      },
      select: USER_PUBLIC_SELECT
    });
  } catch (error) {
    if (error.code === "P2002") {
      const duplicateError = new Error("User with this email already exists.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw error;
  }
}

export async function updateUser(userId, payload) {
  if (!payload || Object.keys(payload).length === 0) {
    const error = new Error("No user fields were provided for update.");
    error.statusCode = 400;
    throw error;
  }

  if (payload.email !== undefined) {
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (current && current.email.toLowerCase() !== String(payload.email).trim().toLowerCase()) {
      assertAllowedEmail(payload.email);
    }
  }

  const { data_scope: dataScope, ...rest } = payload;
  const data = { ...rest, ...(dataScope ? { dataScope } : {}) };
  if (payload.password) {
    data.password = await bcrypt.hash(payload.password, 10);
    data.passwordChangedAt = new Date();
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_PUBLIC_SELECT
    });
    // Role/profile (or password) just changed — drop the cached auth record so
    // the next request re-reads it rather than authorizing on stale data.
    invalidateCachedUser(userId);
    return updated;
  } catch (error) {
    if (error.code === "P2025") {
      const notFoundError = new Error("User not found.");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    if (error.code === "P2002") {
      const duplicateError = new Error("User with this email already exists.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }

    throw error;
  }
}

export async function changePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, password: true } });
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    const error = new Error("Current password is incorrect.");
    error.statusCode = 400;
    throw error;
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  const result = await prisma.user.update({
    where: { id: userId },
    data: { password: hashed, passwordChangedAt: new Date() },
    select: { id: true }
  });
  // The token check keys on passwordChangedAt; clear the cache so old tokens are
  // rejected on the very next request, not up to a TTL later.
  invalidateCachedUser(userId);
  return result;
}

export async function deleteUser(userId) {
  try {
    const deleted = await prisma.user.delete({
      where: { id: userId },
      select: { id: true }
    });
    // Reject any in-flight token for this account on the next request.
    invalidateCachedUser(userId);
    return deleted;
  } catch (error) {
    if (error.code === "P2025") {
      const notFoundError = new Error("User not found.");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    throw error;
  }
}
