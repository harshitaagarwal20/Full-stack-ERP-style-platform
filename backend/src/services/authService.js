import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { signToken } from "../utils/jwt.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";

export async function loginUser(email, password) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      ...USER_PUBLIC_SELECT,
      password: true
    }
  });

  if (!user) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  };
}
