// Mobile-only "recent N" helper for the Production sub-navigation list screens
// (Quality Check, Operation Log, In-Process Testing, Packing).
//
// On mobile, with no active search, these lists show only the most recent few
// records; typing a search shows all matches. On desktop this is a no-op — the
// full list is returned unchanged so the desktop layout/behaviour is identical.
export function pickMobileRecent(list, { isMobile, hasSearch, limit = 5, dateKeys = ["createdAt", "updatedAt"] } = {}) {
  if (!Array.isArray(list)) return [];
  // Desktop, or an active search on mobile → return the list untouched.
  if (!isMobile || hasSearch) return list;

  const getTime = (row) => {
    for (const key of dateKeys) {
      const value = row?.[key];
      if (value) {
        const time = new Date(value).getTime();
        if (!Number.isNaN(time)) return time;
      }
    }
    return 0;
  };

  return [...list].sort((a, b) => getTime(b) - getTime(a)).slice(0, limit);
}
