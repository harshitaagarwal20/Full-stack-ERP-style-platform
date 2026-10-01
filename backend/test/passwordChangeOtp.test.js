import test from "node:test";
import assert from "node:assert/strict";
import {
  changePassword,
  requestPasswordChangeOtp,
  requestPasswordResetOtp,
  resetPasswordWithOtp
} from "../src/services/userService.js";

function buildFakes() {
  const otps = new Map();
  const userUpdates = [];
  const sent = [];
  const user = { id: 7, name: "Sales User", email: "sales@nimbasia.com", password: "stored-hash" };

  const prismaClient = {
    user: {
      async findUnique({ where }) {
        if (where.email !== undefined && where.email !== user.email) return null;
        return user;
      },
      async update(args) {
        userUpdates.push(args);
        return { id: user.id };
      }
    },
    passwordChangeOtp: {
      async upsert({ where, create, update }) {
        otps.set(where.userId, { ...(otps.get(where.userId) ? update : create), userId: where.userId });
      },
      async findUnique({ where }) {
        return otps.get(where.userId) || null;
      },
      async update({ where, data }) {
        const row = otps.get(where.userId);
        row.attempts += data.attempts.increment;
        return row;
      },
      async deleteMany({ where }) {
        const row = otps.get(where.userId);
        if (!row || row.codeHash !== where.codeHash) return { count: 0 };
        otps.delete(where.userId);
        return { count: 1 };
      }
    }
  };

  const bcryptLib = {
    async compare(candidate) {
      return candidate === "old-pass";
    },
    async hash(value) {
      return `hashed:${value}`;
    }
  };

  const mailer = {
    isMailConfigured: () => true,
    async sendMail(message) {
      sent.push(message);
      return true;
    }
  };

  return { prismaClient, bcryptLib, mailer, sent, userUpdates };
}

test("password change needs the emailed 6-digit OTP, and the OTP works once", async () => {
  const { prismaClient, bcryptLib, mailer, sent, userUpdates } = buildFakes();

  const result = await requestPasswordChangeOtp(7, "old-pass", { prismaClient, bcryptLib, mailer });
  assert.equal(result.email, "sa***@nimbasia.com");
  assert.equal(sent.length, 1);
  const otp = sent[0].subject.match(/(\d{6})$/)[1];

  const wrong = otp === "000000" ? "111111" : "000000";
  await assert.rejects(
    changePassword(7, "old-pass", "new-pass", wrong, { prismaClient, bcryptLib }),
    /not correct/
  );
  assert.equal(userUpdates.length, 0);

  await changePassword(7, "old-pass", "new-pass", otp, { prismaClient, bcryptLib });
  assert.equal(userUpdates.length, 1);
  assert.equal(userUpdates[0].data.password, "hashed:new-pass");

  await assert.rejects(
    changePassword(7, "old-pass", "another-pass", otp, { prismaClient, bcryptLib }),
    /expired/
  );
});

test("no OTP is sent when the current password is wrong", async () => {
  const { prismaClient, bcryptLib, mailer, sent } = buildFakes();

  await assert.rejects(
    requestPasswordChangeOtp(7, "not-my-password", { prismaClient, bcryptLib, mailer }),
    /Current password is incorrect/
  );
  assert.equal(sent.length, 0);
});

test("password change refuses without an OTP having been requested", async () => {
  const { prismaClient, bcryptLib } = buildFakes();

  await assert.rejects(
    changePassword(7, "old-pass", "new-pass", "123456", { prismaClient, bcryptLib }),
    /expired/
  );
});

test("forgot password: OTP to the account's email resets the password without the old one", async () => {
  const { prismaClient, bcryptLib, mailer, sent, userUpdates } = buildFakes();

  const result = await requestPasswordResetOtp("sales@nimbasia.com", { prismaClient, mailer });
  assert.match(result.message, /If an account exists/);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "sales@nimbasia.com");
  const otp = sent[0].subject.match(/(\d{6})$/)[1];

  await resetPasswordWithOtp("sales@nimbasia.com", otp, "brand-new", { prismaClient, bcryptLib });
  assert.equal(userUpdates.length, 1);
  assert.equal(userUpdates[0].data.password, "hashed:brand-new");

  await assert.rejects(
    resetPasswordWithOtp("sales@nimbasia.com", otp, "again", { prismaClient, bcryptLib }),
    /expired/
  );
});

test("forgot password gives the same answer for an unknown email and sends nothing", async () => {
  const { prismaClient, mailer, sent } = buildFakes();

  const result = await requestPasswordResetOtp("nobody@nimbasia.com", { prismaClient, mailer });
  assert.match(result.message, /If an account exists/);
  assert.equal(sent.length, 0);
});
