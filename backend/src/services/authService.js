import bcrypt from "bcryptjs";
import prisma from "../config/prisma.js";
import { signToken } from "../utils/jwt.js";
import { USER_PUBLIC_SELECT } from "../utils/selects.js";

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);
}

async function updateLegacyPasswordIfNeeded(client, user, password, bcryptLib) {
  if (!user || isBcryptHash(user.password)) {
    return;
  }

  try {
    const hashedPassword = await bcryptLib.hash(password, 10);
    await client.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });
  } catch {
    // Ignore migration failures so a legacy account can still log in successfully.
  }
}

export async function loginUser(email, password, { prismaClient = prisma, bcryptLib = bcrypt } = {}) {
  const user = await prismaClient.user.findUnique({
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

  const storedPassword = String(user.password || "");
  let isValid = false;

  if (isBcryptHash(storedPassword)) {
    try {
      isValid = await bcryptLib.compare(password, storedPassword);
    } catch {
      isValid = false;
    }
  } else {
    isValid = storedPassword === String(password || "");
  }

  if (!isValid) {
    const error = new Error("Invalid email or password.");
    error.statusCode = 401;
    throw error;
  }

  await updateLegacyPasswordIfNeeded(prismaClient, user, password, bcryptLib);

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
