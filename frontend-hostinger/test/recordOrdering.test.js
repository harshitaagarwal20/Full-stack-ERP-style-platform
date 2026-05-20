import test from "node:test";
import assert from "node:assert/strict";
import { sortByNewestFirst } from "../src/utils/recordOrdering.js";

test("sortByNewestFirst orders newest createdAt first", () => {
  const rows = [
    { id: 1, createdAt: "2024-01-01T10:00:00.000Z" },
    { id: 2, createdAt: "2024-01-03T10:00:00.000Z" },
    { id: 3, createdAt: "2024-01-02T10:00:00.000Z" }
  ];

  const sorted = sortByNewestFirst(rows);

  assert.deepStrictEqual(sorted.map((row) => row.id), [2, 3, 1]);
});

test("sortByNewestFirst falls back to numeric ids when timestamps are missing", () => {
  const rows = [
    { id: 4, name: "oldest" },
    { id: 9, name: "newest" },
    { id: 7, name: "middle" }
  ];

  const sorted = sortByNewestFirst(rows);

  assert.deepStrictEqual(sorted.map((row) => row.id), [9, 7, 4]);
});

test("sortByNewestFirst does not mutate the input array", () => {
  const rows = [
    { id: 1, createdAt: "2024-01-01T00:00:00.000Z" },
    { id: 2, createdAt: "2024-01-02T00:00:00.000Z" }
  ];

  const copy = [...rows];
  const sorted = sortByNewestFirst(rows);

  assert.deepStrictEqual(rows, copy);
  assert.notStrictEqual(sorted, rows);
});
