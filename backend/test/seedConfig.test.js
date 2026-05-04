import assert from "node:assert/strict";
import { ADMIN_SEED_USER, LEGACY_SEED_USER_EMAILS, getBootstrapSeedUsers } from "../prisma/seedConfig.js";

assert.equal(ADMIN_SEED_USER.email, "admin@gmail.com");
assert.equal(ADMIN_SEED_USER.password, "123456");
assert.equal(ADMIN_SEED_USER.role, "admin");

assert.deepEqual(getBootstrapSeedUsers(), [ADMIN_SEED_USER]);
assert(!LEGACY_SEED_USER_EMAILS.includes(ADMIN_SEED_USER.email));

console.log("seedConfig assertions passed");

