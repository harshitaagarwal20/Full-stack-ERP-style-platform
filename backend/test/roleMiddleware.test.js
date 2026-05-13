import test from "node:test";
import assert from "node:assert/strict";
import { allowRoles } from "../src/middleware/roleMiddleware.js";

function runMiddleware(middleware, user) {
  return new Promise((resolve) => {
    const req = { user };
    const next = (error) => resolve({ error, nextCalled: true });

    middleware(req, {}, next);
  });
}

test("allowRoles permits sales for approval routes", async () => {
  const middleware = allowRoles("admin", "sales");
  const result = await runMiddleware(middleware, { role: "sales" });

  assert.equal(result.nextCalled, true);
  assert.equal(result.error, undefined);
});

test("allowRoles still rejects unauthorized roles", async () => {
  const middleware = allowRoles("admin", "sales");
  const result = await runMiddleware(middleware, { role: "production" });

  assert.equal(result.nextCalled, true);
  assert.equal(result.error?.statusCode, 403);
  assert.equal(result.error?.message, "Forbidden for this role.");
});

