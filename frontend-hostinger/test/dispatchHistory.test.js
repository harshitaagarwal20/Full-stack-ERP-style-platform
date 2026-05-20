import test from "node:test";
import assert from "node:assert/strict";
import {
  getDispatchEditableRemainingQuantity,
  getDispatchRemainingQuantity,
  sortDispatchHistory
} from "../src/utils/dispatchHistory.js";

test("sortDispatchHistory orders dispatches chronologically", () => {
  const dispatches = [
    { id: 3, dispatchedQuantity: 28, dispatchDate: "2026-04-03", createdAt: "2026-04-03T10:00:00Z" },
    { id: 1, dispatchedQuantity: 28, dispatchDate: "2026-04-01", createdAt: "2026-04-01T10:00:00Z" },
    { id: 2, dispatchedQuantity: 28, dispatchDate: "2026-04-02", createdAt: "2026-04-02T10:00:00Z" }
  ];

  assert.deepEqual(sortDispatchHistory(dispatches).map((item) => item.id), [1, 2, 3]);
});

test("getDispatchRemainingQuantity steps down by dispatch sequence", () => {
  const order = {
    quantity: 140,
    remainingQuantity: 56,
    dispatches: [
      { id: 3, dispatchedQuantity: 28, dispatchDate: "2026-04-03", createdAt: "2026-04-03T10:00:00Z" },
      { id: 1, dispatchedQuantity: 28, dispatchDate: "2026-04-01", createdAt: "2026-04-01T10:00:00Z" },
      { id: 2, dispatchedQuantity: 28, dispatchDate: "2026-04-02", createdAt: "2026-04-02T10:00:00Z" }
    ]
  };

  assert.equal(getDispatchRemainingQuantity(order, { id: 1 }), 112);
  assert.equal(getDispatchRemainingQuantity(order, { id: 2 }), 84);
  assert.equal(getDispatchRemainingQuantity(order, { id: 3 }), 56);
});

test("getDispatchRemainingQuantity falls back to the order-level remaining quantity for summary rows", () => {
  const order = {
    quantity: 140,
    remainingQuantity: 84,
    dispatches: [{ id: 1, dispatchedQuantity: 28 }]
  };

  assert.equal(getDispatchRemainingQuantity(order, null), 84);
});

test("getDispatchEditableRemainingQuantity updates live while typing in create mode", () => {
  const order = {
    quantity: 140,
    remainingQuantity: 56
  };

  assert.equal(getDispatchEditableRemainingQuantity(order, 10), 46);
  assert.equal(getDispatchEditableRemainingQuantity(order, 60), 0);
});

test("getDispatchEditableRemainingQuantity preserves the original dispatch quantity in edit mode", () => {
  const order = {
    quantity: 140,
    remainingQuantity: 56
  };

  assert.equal(getDispatchEditableRemainingQuantity(order, 25, 20), 51);
  assert.equal(getDispatchEditableRemainingQuantity(order, 100, 20), 0);
});
