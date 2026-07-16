import assert from "node:assert/strict";
import test from "node:test";
import { buildBatchSchedule, splitQuantityEvenly } from "../src/services/productionService.js";

test("splitQuantityEvenly divides the job into batches that sum back to the total", () => {
  assert.deepEqual(splitQuantityEvenly(5000, 10), Array(10).fill(500));

  // Remainder is spread across the leading batches, not dumped on the last one,
  // so no single batch is wildly different from the others.
  assert.deepEqual(splitQuantityEvenly(7, 3), [3, 2, 2]);
  assert.deepEqual(splitQuantityEvenly(5000, 3), [1667, 1667, 1666]);

  for (const [total, count] of [[5000, 10], [7, 3], [5000, 3], [101, 4], [2, 2]]) {
    const batches = splitQuantityEvenly(total, count);
    assert.equal(batches.length, count, `${total}/${count}: batch count`);
    assert.equal(batches.reduce((sum, qty) => sum + qty, 0), total, `${total}/${count}: sums back to total`);
    assert.ok(batches.every((qty) => qty >= 1), `${total}/${count}: every batch is at least 1 unit`);
    assert.ok(Math.max(...batches) - Math.min(...batches) <= 1, `${total}/${count}: batches are within 1 unit`);
  }
});

test("buildBatchSchedule spreads batches between now and the order due date, last one landing on it", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");
  const due = new Date("2026-08-22T00:00:00.000Z"); // 40 days out
  const schedule = buildBatchSchedule(due, 4, now);

  assert.equal(schedule.length, 4);

  // Evenly spread: 10 days apart, with the final batch due exactly on the date
  // promised to the customer.
  assert.equal(schedule[0].toISOString(), "2026-07-23T00:00:00.000Z");
  assert.equal(schedule[1].toISOString(), "2026-08-02T00:00:00.000Z");
  assert.equal(schedule[2].toISOString(), "2026-08-12T00:00:00.000Z");
  assert.equal(schedule[3].toISOString(), due.toISOString());

  // Batch 1 is due soonest, so it heads the production queue.
  for (let i = 1; i < schedule.length; i += 1) {
    assert.ok(schedule[i] > schedule[i - 1], "each batch is due after the previous one");
  }
});

test("buildBatchSchedule gives every batch the due date when the order is already due or overdue", () => {
  const now = new Date("2026-07-13T00:00:00.000Z");
  const overdue = new Date("2026-07-01T00:00:00.000Z");

  // No window left to spread over — don't invent dates in the past.
  const schedule = buildBatchSchedule(overdue, 3, now);
  assert.equal(schedule.length, 3);
  for (const date of schedule) {
    assert.equal(date.toISOString(), overdue.toISOString());
  }
});
