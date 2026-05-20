const DATA_SYNC_EVENT = "nimbasia-data-sync";
const DATA_SYNC_STORAGE_KEY = "nimbasia_data_sync";
const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);
const MUTATION_PATH_PREFIXES = ["/orders", "/production", "/dispatch", "/enquiries", "/manual-order-requests"];

function normalizePath(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    return new URL(raw, "http://nimbasia.local").pathname;
  } catch {
    return raw.split("?")[0];
  }
}

export function shouldBroadcastDataSync(config = {}) {
  const method = String(config.method || "").toLowerCase();
  if (!MUTATING_METHODS.has(method)) {
    return false;
  }

  const path = normalizePath(config.url);
  return MUTATION_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function publishDataSync(detail = {}) {
  const payload = {
    ...detail,
    issuedAt: Date.now()
  };

  if (typeof window !== "undefined") {
    try {
      window.dispatchEvent(new CustomEvent(DATA_SYNC_EVENT, { detail: payload }));
    } catch {
      // Ignore event dispatch failures and continue with storage broadcast.
    }

    try {
      window.localStorage?.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage failures and keep the current tab responsive.
    }
  }

  return payload;
}

export { DATA_SYNC_EVENT, DATA_SYNC_STORAGE_KEY };
