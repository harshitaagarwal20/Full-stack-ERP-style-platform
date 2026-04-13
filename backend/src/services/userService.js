import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { buildPagination } from "../utils/pagination.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";

export async function listUsers(query = {}) {
  const { page, take, skip } = buildPagination(query, { defaultLimit: 0, maxLimit: 100 });

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

export async function createUser(payload) {
  const hashedPassword = await bcrypt.hash(payload.password, 10);

  try {
    return await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        password: hashedPassword,
        role: payload.role
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

  const data = { ...payload };
  if (payload.password) {
    data.password = await bcrypt.hash(payload.password, 10);
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: USER_PUBLIC_SELECT
    });
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

export async function deleteUser(userId) {
  try {
    return await prisma.user.delete({
      where: { id: userId },
      select: { id: true }
    });
  } catch (error) {
    if (error.code === "P2025") {
      const notFoundError = new Error("User not found.");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    throw error;
  }
}
