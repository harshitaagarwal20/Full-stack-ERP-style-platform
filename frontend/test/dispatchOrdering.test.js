import test from "node:test";
import assert from "node:assert/strict";
import { getDispatchSortPriority } from "../src/utils/dispatchOrdering.js";

test("getDispatchSortPriority puts pending dispatch rows first", () => {
  assert.equal(getDispatchSortPriority({ dispatch: null }), 0);
  assert.equal(getDispatchSortPriority({ dispatch: { shipmentStatus: "PACKED" } }), 0);
  assert.equal(getDispatchSortPriority({ dispatch: { shipmentStatus: "SHIPPED" } }), 1);
  assert.equal(getDispatchSortPriority({ dispatch: { shipmentStatus: "DELIVERED" } }), 1);
});

