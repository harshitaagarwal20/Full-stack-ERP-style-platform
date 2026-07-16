// Dates that record "when this happened" — enquiry raised, PO placed, goods
// received, batch dispatched, sample analysed — may not be pushed further than
// one day into the past. Anything older is either a typo or an attempt to slip
// an entry into a period that has already been reported on.
//
// Only entry dates are covered. Forward-looking dates (expected delivery,
// expected timeline), supplier-supplied facts (raw material mfg/expiry date)
// and list-page filters are all free to sit wherever they need to.
export const MAX_BACKDATE_DAYS = 1;

// Day key in UTC, matching how the services turn a "YYYY-MM-DD" field into a
// Date (`new Date("2026-07-14")` is UTC midnight). Comparing on the same axis
// the values were built on keeps the boundary stable.
function toDayKey(value) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// Oldest date an entry field may carry, as "YYYY-MM-DD".
export function minEntryDate(now = new Date()) {
  const floor = new Date(now.getTime());
  floor.setUTCDate(floor.getUTCDate() - MAX_BACKDATE_DAYS);
  return floor.toISOString().slice(0, 10);
}

export function isBackdated(value, now = new Date()) {
  const day = toDayKey(value);
  if (!day) return false;
  return day < minEntryDate(now);
}

// Rejects `value` if it is backdated by more than a day.
//
// `grandfathered` carries the values the record already holds. An edit to a
// months-old enquiry re-submits its original enquiry date untouched, and that
// has to keep working — the rule is about what someone types in now, not about
// re-litigating history. Only a date that actually changes is checked.
// Seed scripts build a plausible history — a PO raised three weeks ago, its GRN
// received last week — by driving the very services this rule guards. They are
// writing the past on purpose, which is exactly what the rule exists to stop a
// user doing, so they get an explicit opt-out rather than the rule being watered
// down for everyone.
//
// Never set this outside a seed: it is the whole rule, switched off.
const backdatingAllowed = () => process.env.ALLOW_BACKDATED_ENTRY === "1";

export function assertEntryDate(value, label, { grandfathered = [], now = new Date() } = {}) {
  if (!value) return;
  if (backdatingAllowed()) return;
  if (!isBackdated(value, now)) return;

  const existing = new Set(
    (Array.isArray(grandfathered) ? grandfathered : [grandfathered])
      .map(toDayKey)
      .filter(Boolean)
  );
  if (existing.has(toDayKey(value))) return;

  const error = new Error(
    `${label} cannot be backdated by more than ${MAX_BACKDATE_DAYS} day. The earliest allowed date is ${minEntryDate(now)}.`
  );
  error.statusCode = 400;
  throw error;
}
