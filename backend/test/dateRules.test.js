import assert from "node:assert/strict";
import test from "node:test";
import { assertEntryDate, isBackdated, minEntryDate } from "../src/utils/dateRules.js";

const NOW = new Date("2026-07-14T10:00:00Z");

test("the floor is one day back", () => {
  assert.equal(minEntryDate(NOW), "2026-07-13");
});

test("today, yesterday and the future are all fine", () => {
  assert.equal(isBackdated("2026-07-14", NOW), false);
  assert.equal(isBackdated("2026-07-13", NOW), false);
  assert.equal(isBackdated("2026-08-01", NOW), false);
});

test("two days back and older is backdated", () => {
  assert.equal(isBackdated("2026-07-12", NOW), true);
  assert.equal(isBackdated("2025-01-01", NOW), true);
});

test("an empty date is not the backdating rule's problem", () => {
  assert.equal(isBackdated("", NOW), false);
  assert.equal(isBackdated(null, NOW), false);
  assert.doesNotThrow(() => assertEntryDate(null, "Enquiry date", { now: NOW }));
});

test("assertEntryDate rejects a backdated value with a 400", () => {
  assert.throws(
    () => assertEntryDate("2026-06-01", "Enquiry date", { now: NOW }),
    (error) => {
      assert.equal(error.statusCode, 400);
      assert.match(error.message, /Enquiry date cannot be backdated/);
      assert.match(error.message, /2026-07-13/);
      return true;
    }
  );
});

// Editing a months-old record resubmits its original date untouched. The rule is
// about what someone types in now, so that has to keep working.
test("a date the record already holds is grandfathered through", () => {
  assert.doesNotThrow(() => assertEntryDate("2026-01-09", "Enquiry date", {
    grandfathered: new Date("2026-01-09T00:00:00Z"),
    now: NOW
  }));
});

test("but changing that old date to a different old date is still rejected", () => {
  assert.throws(() => assertEntryDate("2026-01-08", "Enquiry date", {
    grandfathered: new Date("2026-01-09T00:00:00Z"),
    now: NOW
  }), /cannot be backdated/);
});

// Sheet rows are replaced wholesale, so every date already on the sheet is fair
// game for any row coming back in.
test("a sheet's saved dates are grandfathered as a set", () => {
  const saved = [new Date("2026-03-01T00:00:00Z"), new Date("2026-03-05T00:00:00Z")];
  assert.doesNotThrow(() => assertEntryDate("2026-03-05", "Date of sampling", { grandfathered: saved, now: NOW }));
  assert.throws(() => assertEntryDate("2026-03-06", "Date of sampling", { grandfathered: saved, now: NOW }));
});
