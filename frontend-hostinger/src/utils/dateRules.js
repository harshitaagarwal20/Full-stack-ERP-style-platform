// Mirrors backend/src/utils/dateRules.js — see that file for the rule itself.
// This side only greys out the earlier days in the picker; the backend is what
// actually enforces it.
export const MAX_BACKDATE_DAYS = 1;

// Oldest date an entry field may carry, as "YYYY-MM-DD". Feed it to a
// <input type="date" min={...} />.
export function minEntryDate(now = new Date()) {
  const floor = new Date(now.getFullYear(), now.getMonth(), now.getDate() - MAX_BACKDATE_DAYS);
  const month = String(floor.getMonth() + 1).padStart(2, "0");
  const day = String(floor.getDate()).padStart(2, "0");
  return `${floor.getFullYear()}-${month}-${day}`;
}

// A record loaded for editing may legitimately hold a date older than the
// floor. Widen `min` to that value so the picker doesn't fight the user over a
// date they aren't changing.
export function minEntryDateFor(currentValue, now = new Date()) {
  const floor = minEntryDate(now);
  const existing = String(currentValue || "").slice(0, 10);
  return existing && existing < floor ? existing : floor;
}
