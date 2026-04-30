import assert from "node:assert/strict";
import { cleanupAuditLogRetention } from "../src/services/auditService.js";

const calls = [];

const client = {
  async $executeRawUnsafe(sql, ...params) {
    const statement = String(sql).replace(/\s+/g, " ").trim();
    calls.push({ statement, params });

    if (statement.startsWith("INSERT IGNORE INTO `AuditLogBackup`")) {
      return 4;
    }

    if (statement.startsWith("DELETE FROM `AuditLog`")) {
      return 4;
    }

    if (statement.startsWith("DELETE FROM `AuditLogBackup`")) {
      return 2;
    }

    return 1;
  }
};

const result = await cleanupAuditLogRetention(client);

assert.deepEqual(result, {
  archivedCount: 4,
  deletedCount: 4,
  prunedBackupCount: 2
});

assert.equal(calls.length, 5);
assert(calls.some((call) => call.statement.startsWith("CREATE TABLE IF NOT EXISTS `AuditLog`")));
assert(calls.some((call) => call.statement.startsWith("CREATE TABLE IF NOT EXISTS `AuditLogBackup`")));

const archiveCall = calls.find((call) => call.statement.startsWith("INSERT IGNORE INTO `AuditLogBackup`"));
assert(archiveCall);
assert.equal(archiveCall.params.length, 1);
assert(archiveCall.params[0] instanceof Date);

console.log("auditRetention assertions passed");
