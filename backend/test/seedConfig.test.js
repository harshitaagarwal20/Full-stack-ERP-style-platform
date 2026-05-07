import assert from "node:assert/strict";
import { LEGACY_SEED_USER_EMAILS } from "../prisma/seedConfig.js";

assert.deepEqual(LEGACY_SEED_USER_EMAILS, [
  "admin@fms.com",
  "sales1@fms.com",
  "sales2@fms.com",
  "production@fms.com",
  "dispatch@fms.com"
]);
assert(!LEGACY_SEED_USER_EMAILS.includes("admin@gmail.com"));

console.log("seedConfig assertions passed");
