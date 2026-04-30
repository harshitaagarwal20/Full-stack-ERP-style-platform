import assert from "node:assert/strict";
import { cleanupAuditLogRetention } from "../src/services/auditService.js";

const calls = [];

const client = {
  async $executeRawUnsafe(sql, ...params) {
    const statement = String(sql).replace(/\s+/g, " ").trim();
    calls.push({ statement, params });

    if (statement.startsWith("DELETE FROM `AuditLog`")) {
      return 4;
    }

    return 1;
  }
};

const result = await cleanupAuditLogRetention(client);

assert.deepEqual(result, {
  deletedCount: 4
});

assert.equal(calls.length, 2);
assert(calls.some((call) => call.statement.startsWith("CREATE TABLE IF NOT EXISTS `AuditLog`")));
assert(calls.some((call) => call.statement.startsWith("DELETE FROM `AuditLog`")));
const deleteCall = calls.find((call) => call.statement.startsWith("DELETE FROM `AuditLog`"));
assert(deleteCall);
assert.equal(deleteCall.params.length, 1);
assert(deleteCall.params[0] instanceof Date);

console.log("auditRetention assertions passed");
