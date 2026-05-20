import test from "node:test";
import assert from "node:assert/strict";
import { getDispatchShipmentStatusOptions } from "../src/utils/dispatchStatusOptions.js";

test("create mode allows delivered when dispatch quantity matches remaining quantity", () => {
  const options = getDispatchShipmentStatusOptions({
    order: { quantity: 140, remainingQuantity: 28 },
    dispatchQty: 28,
    mode: "create"
  });

  assert.deepEqual(options, [
    { value: "PACKING", label: "Pending" },
    { value: "SHIPPED", label: "Dispatched" },
    { value: "DELIVERED", label: "Delivered" }
  ]);
});

test("edit mode does not expose delivered", () => {
  const options = getDispatchShipmentStatusOptions({
    order: { quantity: 140, remainingQuantity: 28 },
    dispatchQty: 28,
    mode: "edit",
    currentShipmentStatus: "DELIVERED"
  });

  assert.deepEqual(options, [
    { value: "PACKING", label: "Pending" },
    { value: "SHIPPED", label: "Dispatched" }
  ]);
});
