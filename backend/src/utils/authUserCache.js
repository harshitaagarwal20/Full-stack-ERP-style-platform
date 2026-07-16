// Every authenticated request re-fetched the user from the database purely to
// re-authorize the token. Locally that is sub-millisecond; against a remote
// MySQL (Hostinger) it is a full network round-trip added to *every* API call,
// which — on a page that fires several calls — was the bulk of the load time.
//
// So the lookup is cached for a short window per user. Active users, who make
// requests in bursts, then pay the round-trip once rather than per call. The
// window is deliberately short: a deleted account or a changed password is
// honoured within TTL seconds anyway, and the write paths clear the entry so
// those take effect immediately rather than waiting it out.
const TTL_MS = 30 * 1000;

const cache = new Map(); // userId -> { user, expires }

export function getCachedUser(userId) {
  const hit = cache.get(userId);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    cache.delete(userId);
    return null;
  }
  return hit.user;
}

export function setCachedUser(userId, user) {
  cache.set(userId, { user, expires: Date.now() + TTL_MS });
}

// Called whenever a user's record changes in a way the token check depends on —
// password change, role/profile update, deletion — so a stale entry can't keep
// authorizing a request it should now reject.
export function invalidateCachedUser(userId) {
  cache.delete(Number(userId));
  cache.delete(String(userId));
}
