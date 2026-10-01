import test from "node:test";
import assert from "node:assert/strict";
import { invoiceAmount, summariseInvoice } from "../src/services/paymentService.js";

const order = { price: 50 };
const dispatch = (quantity, payments = []) => ({ dispatchedQuantity: quantity, payments });

test("invoice amount is dispatched quantity at the order price", () => {
  assert.equal(invoiceAmount(dispatch(10), order), 500);
  assert.equal(invoiceAmount(dispatch(10), { price: null }), null);
});

test("partial receipts leave the balance pending", () => {
  const result = summariseInvoice(dispatch(10, [{ amount: 200, paymentType: "PARTIAL" }]), order);
  assert.deepEqual(result, { amount: 500, received: 200, pending: 300, settled: false });
});

test("receipts that add up to the invoice settle it", () => {
  const result = summariseInvoice(
    dispatch(10, [{ amount: 200, paymentType: "PARTIAL" }, { amount: 300, paymentType: "PARTIAL" }]),
    order
  );
  assert.equal(result.settled, true);
  assert.equal(result.pending, 0);
});

test("an unpriced invoice is only settled by a full receipt", () => {
  const unpriced = { price: null };
  assert.equal(summariseInvoice(dispatch(10, [{ amount: 100, paymentType: "PARTIAL" }]), unpriced).settled, false);
  assert.equal(summariseInvoice(dispatch(10, [{ amount: 100, paymentType: "FULL" }]), unpriced).settled, true);
  assert.equal(summariseInvoice(dispatch(10), unpriced).pending, null);
});
