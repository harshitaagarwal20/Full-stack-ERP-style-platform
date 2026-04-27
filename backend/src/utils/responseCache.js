const valueStore = new Map();
const inFlightStore = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${pairs.join(",")}}`;
  }

  return JSON.stringify(value);
}

export function buildCacheKey(prefix, input = {}) {
  return `${prefix}:${stableStringify(input)}`;
}

export function invalidateCacheByPrefix(prefix) {
  for (const key of valueStore.keys()) {
    if (key.startsWith(prefix)) {
      valueStore.delete(key);
    }
  }
  for (const key of inFlightStore.keys()) {
    if (key.startsWith(prefix)) {
      inFlightStore.delete(key);
    }
  }
}

export async function getOrLoadCached(key, ttlMs, loader) {
  const now = Date.now();
  const cached = valueStore.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlightStore.has(key)) {
    return inFlightStore.get(key);
  }

  const promise = Promise.resolve()
    .then(loader)
    .then((value) => {
      valueStore.set(key, {
        value,
        expiresAt: Date.now() + Math.max(0, Number(ttlMs) || 0)
      });
      return value;
    })
    .finally(() => {
      inFlightStore.delete(key);
    });

  inFlightStore.set(key, promise);
  return promise;
}
