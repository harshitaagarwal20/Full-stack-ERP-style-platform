// Month filter shared by every list screen, so "July" means the same thing
// everywhere. Accepts the value an <input type="month"> produces: "YYYY-MM".
//
// The range is half-open ([start of month, start of next month)) rather than
// clamped to 23:59:59.999 on the last day — that way a record stamped in the
// final millisecond of the month can't slip through the gap.
export function buildMonthRange(month) {
  const normalized = String(month || "").trim();
  if (!/^\d{4}-\d{2}$/.test(normalized)) return null;

  const [year, monthIndex] = normalized.split("-").map(Number);
  if (monthIndex < 1 || monthIndex > 12) return null;

  const gte = new Date(Date.UTC(year, monthIndex - 1, 1, 0, 0, 0, 0));
  const lt = new Date(Date.UTC(monthIndex === 12 ? year + 1 : year, monthIndex % 12, 1, 0, 0, 0, 0));

  return { gte, lt };
}

// Prisma `where` fragment for a month filter on one field, or {} when no month
// is supplied — safe to spread unconditionally.
export function monthWhere(field, month) {
  const range = buildMonthRange(month);
  if (!range) return {};
  return { [field]: range };
}

// Rolling "last N days" window. The mobile app asks for 45 days so a phone
// never pulls years of history over a mobile connection; desktop omits it and
// sees everything. Capped so a client can't turn it into an unbounded scan by
// asking for a silly number.
const MAX_RECENT_DAYS = 3650;

export function buildRecentDaysCutoff(days) {
  const numeric = Number(days);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const bounded = Math.min(Math.floor(numeric), MAX_RECENT_DAYS);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - bounded);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

export function recentDaysWhere(field, days) {
  const cutoff = buildRecentDaysCutoff(days);
  if (!cutoff) return {};
  return { [field]: { gte: cutoff } };
}
