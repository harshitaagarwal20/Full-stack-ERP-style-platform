import assert from "node:assert/strict";
import { ensureAuditLogTable } from "../src/services/auditService.js";

const originalWarn = console.warn;
const warnings = [];

console.warn = (...args) => {
  warnings.push(args.map((value) => String(value)).join(" "));
};

let attempts = 0;
const client = {
  async $executeRawUnsafe() {
    attempts += 1;

    if (attempts === 1) {
      const error = new Error("Can't reach database server");
      error.name = "PrismaClientInitializationError";
      throw error;
    }

    return 1;
  }
};

try {
  const firstAttempt = await ensureAuditLogTable(client, { suppressErrors: true });
  assert.equal(firstAttempt, false);
  assert.equal(attempts, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Audit log table initialization skipped/);

  const secondAttempt = await ensureAuditLogTable(client);
  assert.equal(secondAttempt, true);
  assert.equal(attempts, 2);

  const thirdAttempt = await ensureAuditLogTable(client);
  assert.equal(thirdAttempt, true);
  assert.equal(attempts, 2);
} finally {
  console.warn = originalWarn;
}

console.log("auditService assertions passed");
