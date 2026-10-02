import test from "node:test";
import assert from "node:assert/strict";
import {
  AGING_START_DATE,
  invoiceAmount,
  parseAgingWindow,
  summariseInvoice
} from "../src/services/paymentService.js";

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

const iso = (date) => date.toISOString();

test("the aging window defaults to the go-live cut-off and runs to now", () => {
  const { from, asOn } = parseAgingWindow({});
  assert.equal(iso(from), `${AGING_START_DATE}T00:00:00.000Z`);
  assert.ok(asOn.getTime() <= Date.now());
});

test("as_on covers the whole of its day and from starts at midnight", () => {
  const { from, asOn } = parseAgingWindow({ from: "2026-10-01", as_on: "2026-11-30" });
  assert.equal(iso(from), "2026-10-01T00:00:00.000Z");
  assert.equal(iso(asOn), "2026-11-30T23:59:59.999Z");
});

test("an explicit blank from drops the cut-off", () => {
  assert.equal(parseAgingWindow({ from: "" }).from, null);
  assert.equal(parseAgingWindow({ from: "   " }).from, null);
});

test("dates that are not real calendar days are rejected", () => {
  for (const value of ["2026-02-30", "2026", "2026-13-01", "01/10/2026", "2026-10-1"]) {
    assert.throws(() => parseAgingWindow({ from: value }), { statusCode: 400 }, value);
    assert.throws(() => parseAgingWindow({ as_on: value }), { statusCode: 400 }, value);
  }
  const leap = parseAgingWindow({ from: "2028-02-29", as_on: "2028-03-31" });
  assert.equal(iso(leap.from), "2028-02-29T00:00:00.000Z");
});

test("an inverted window is rejected rather than reported as nothing outstanding", () => {
  assert.throws(() => parseAgingWindow({ from: "2026-12-01", as_on: "2026-11-30" }), { statusCode: 400 });
  assert.doesNotThrow(() => parseAgingWindow({ from: "2026-11-30", as_on: "2026-11-30" }));
});
