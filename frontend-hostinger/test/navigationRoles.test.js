import test from "node:test";
import assert from "node:assert/strict";
import { getNavItemsByRole } from "../src/config/navigation.js";

test("production role only sees production screen and shared dashboard access is omitted", () => {
  const items = getNavItemsByRole("production").map((item) => item.to);
  assert.deepEqual(items, ["/production"]);
});

test("dispatch role only sees dispatch screens", () => {
  const items = getNavItemsByRole("dispatch").map((item) => item.to);
  assert.deepEqual(items, ["/dispatch", "/pending-dispatch-date"]);
});

test("sales role sees approval along with sales screens", () => {
  const items = getNavItemsByRole("sales").map((item) => item.to);
  assert.deepEqual(items, ["/", "/enquiries", "/approval", "/orders"]);
});

test("admin sees all navigation items", () => {
  const items = getNavItemsByRole("admin").map((item) => item.to);
  assert(items.includes("/"));
  assert(items.includes("/production"));
  assert(items.includes("/dispatch"));
  assert(items.includes("/users"));
});
