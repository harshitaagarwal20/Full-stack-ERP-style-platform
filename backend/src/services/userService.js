import bcrypt from "bcryptjs";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import prisma from "../config/prisma.js";
import env from "../config/env.js";
import { isMailConfigured, sendMail } from "../utils/mailer.js";
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

const PASSWORD_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_OTP_MAX_ATTEMPTS = 5;
// A new OTP resets the wrong-guess counter, so issuing them back to back would
// make the attempt cap meaningless. One per minute keeps guesses bounded.
const PASSWORD_OTP_RESEND_COOLDOWN_MS = 60 * 1000;

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Only an HMAC of the code is stored. Keyed on the user and the code's expiry
// so the same six digits never hash the same way twice.
function hashPasswordOtp(userId, expiresAt, code) {
  return createHmac("sha256", env.jwtSecret)
    .update(`${userId}:${expiresAt.getTime()}:${code}`)
    .digest("hex");
}

function maskEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

async function loadUserCheckingPassword(userId, currentPassword, { prismaClient, bcryptLib }) {
  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, password: true }
  });
  if (!user) throw httpError("User not found.", 404);

  const valid = await bcryptLib.compare(currentPassword, user.password);
  if (!valid) throw httpError("Current password is incorrect.", 400);
  return user;
}

// Emails a random 6-digit OTP and stores its hash. Asking again replaces any
// OTP still outstanding for the user, but not more than once a minute.
async function issuePasswordOtp(user, { prismaClient, mailer, subject, intro, warning }) {
  if (!mailer.isMailConfigured()) {
    console.error("[password-otp] SMTP is not configured, so no OTP can be sent.");
    throw httpError("The OTP could not be sent because email is not set up on the server. Contact your administrator.", 502);
  }

  const outstanding = await prismaClient.passwordChangeOtp.findUnique({ where: { userId: user.id } });
  if (outstanding) {
    const issuedAt = outstanding.expiresAt.getTime() - PASSWORD_OTP_TTL_MS;
    if (Date.now() - issuedAt < PASSWORD_OTP_RESEND_COOLDOWN_MS) {
      throw httpError("An OTP was just sent. Wait a minute before asking for another.", 429);
    }
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + PASSWORD_OTP_TTL_MS);
  const codeHash = hashPasswordOtp(user.id, expiresAt, code);

  await prismaClient.passwordChangeOtp.upsert({
    where: { userId: user.id },
    create: { userId: user.id, codeHash, expiresAt, attempts: 0 },
    update: { codeHash, expiresAt, attempts: 0 }
  });

  const minutes = PASSWORD_OTP_TTL_MS / 60000;
  try {
    await mailer.sendMail({
      to: user.email,
      subject: `${subject}: ${code}`,
      text: [
        `Hello ${user.name},`,
        "",
        `${intro} ${code}.`,
        `It expires in ${minutes} minutes and can be used once.`,
        "",
        warning
      ].join("\n")
    });
  } catch (error) {
    console.error("[password-otp] Failed to send OTP:", error);
    throw httpError("We could not send the OTP. Please try again.", 502);
  }

  return { email: maskEmail(user.email), expiresInMinutes: minutes };
}

// Checks the OTP and deletes it, so it works once. Wrong guesses are counted
// and the OTP is dead after PASSWORD_OTP_MAX_ATTEMPTS of them.
async function consumePasswordOtp(userId, otp, { prismaClient }) {
  const record = await prismaClient.passwordChangeOtp.findUnique({ where: { userId } });
  if (!record || record.expiresAt.getTime() < Date.now()) {
    throw httpError("The OTP has expired. Request a new one.", 400);
  }
  if (record.attempts >= PASSWORD_OTP_MAX_ATTEMPTS) {
    throw httpError("Too many wrong OTPs. Request a new one.", 400);
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashPasswordOtp(userId, record.expiresAt, String(otp ?? "").trim()), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    await prismaClient.passwordChangeOtp.update({
      where: { userId },
      data: { attempts: { increment: 1 } }
    });
    const remaining = PASSWORD_OTP_MAX_ATTEMPTS - record.attempts - 1;
    throw httpError(
      remaining > 0
        ? `The OTP is not correct. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
        : "Too many wrong OTPs. Request a new one.",
      400
    );
  }

  // deleteMany on the exact hash: if two submits race, only the one that
  // removes the row goes on to change the password.
  const claimed = await prismaClient.passwordChangeOtp.deleteMany({
    where: { userId, codeHash: record.codeHash }
  });
  if (claimed.count !== 1) {
    throw httpError("The OTP has already been used. Request a new one.", 400);
  }
}

async function saveNewPassword(userId, newPassword, { prismaClient, bcryptLib }) {
  const hashed = await bcryptLib.hash(newPassword, 10);
  const result = await prismaClient.user.update({
    where: { id: userId },
    data: { password: hashed, passwordChangedAt: new Date() },
    select: { id: true }
  });
  // The token check keys on passwordChangedAt; clear the cache so old tokens are
  // rejected on the very next request, not up to a TTL later.
  invalidateCachedUser(userId);
  return result;
}

// Change password, step 1: prove the current password, then get an OTP.
export async function requestPasswordChangeOtp(
  userId,
  currentPassword,
  { prismaClient = prisma, bcryptLib = bcrypt, mailer = { isMailConfigured, sendMail } } = {}
) {
  const user = await loadUserCheckingPassword(userId, currentPassword, { prismaClient, bcryptLib });
  return issuePasswordOtp(user, {
    prismaClient,
    mailer,
    subject: "Your Nimbasia password change OTP",
    intro: "Your OTP to change your Nimbasia password is",
    warning: "If you did not ask to change your password, someone may be signed in as you. Tell your administrator."
  });
}

// Change password, step 2: the current password and the OTP must both check out.
export async function changePassword(
  userId,
  currentPassword,
  newPassword,
  otp,
  { prismaClient = prisma, bcryptLib = bcrypt } = {}
) {
  const user = await loadUserCheckingPassword(userId, currentPassword, { prismaClient, bcryptLib });
  await consumePasswordOtp(user.id, otp, { prismaClient });
  return saveNewPassword(user.id, newPassword, { prismaClient, bcryptLib });
}

// Same answer whether or not the address has an account, so the forgot-password
// form can't be used to find out who has one.
const RESET_OTP_SENT_MESSAGE = "If an account exists for that email, an OTP has been sent to it.";

async function findUserByEmail(email, prismaClient) {
  const normalized = String(email || "").trim();
  if (!normalized) return null;
  return prismaClient.user.findUnique({
    where: { email: normalized },
    select: { id: true, name: true, email: true }
  });
}

// Forgot password, step 1 (signed out): email an OTP to the account's address.
export async function requestPasswordResetOtp(
  email,
  { prismaClient = prisma, mailer = { isMailConfigured, sendMail } } = {}
) {
  const minutes = PASSWORD_OTP_TTL_MS / 60000;
  const user = await findUserByEmail(email, prismaClient);
  if (!user) {
    return { message: RESET_OTP_SENT_MESSAGE, expiresInMinutes: minutes };
  }

  // Whatever goes wrong past this point (mail not set up, send failed, asked
  // too soon) is logged but answered the same as an unknown address — a
  // different response would tell the caller the account exists.
  try {
    await issuePasswordOtp(user, {
      prismaClient,
      mailer,
      subject: "Your Nimbasia password reset OTP",
      intro: "Your OTP to reset your Nimbasia password is",
      warning: "If you did not ask to reset your password, ignore this email. Your password stays the same."
    });
  } catch (error) {
    if (!error.statusCode) throw error;
  }
  return { message: RESET_OTP_SENT_MESSAGE, expiresInMinutes: minutes };
}

// Forgot password, step 2: the emailed OTP alone proves who it is.
export async function resetPasswordWithOtp(
  email,
  otp,
  newPassword,
  { prismaClient = prisma, bcryptLib = bcrypt } = {}
) {
  const user = await findUserByEmail(email, prismaClient);
  if (!user) {
    throw httpError("The OTP has expired. Request a new one.", 400);
  }
  await consumePasswordOtp(user.id, otp, { prismaClient });
  return saveNewPassword(user.id, newPassword, { prismaClient, bcryptLib });
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
