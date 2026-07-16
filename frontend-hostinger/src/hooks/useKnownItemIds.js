import { useEffect, useState } from "react";
import api from "../api/axiosClient";

// Known raw material item IDs (from received GRNs / past usage), used to
// power a datalist so production staff pick an existing item instead of
// free-typing a name that silently becomes an untracked "ghost" item.
//
// The list barely changes, but every page using this hook re-fetched it on
// mount, and two components on one page each fired their own request. It is now
// served from cache on the first render (nothing to wait for), shared across
// mounts, and revalidated in the background. Same shape as useMasterData.
const CACHE_KEY = "fms_item_ids";
const TTL_MS = 5 * 60 * 1000;

let memoryCache = null;
let inFlight = null;

function readCache() {
  try {
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.itemIds)) return null;
    return { itemIds: parsed.itemIds, fetchedAt: Number(parsed.fetchedAt || 0) };
  } catch {
    return null;
  }
}

function writeCache(cache) {
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or unavailable — the memory cache still holds.
  }
}

if (typeof window !== "undefined") {
  memoryCache = readCache();
}

function loadItemIds() {
  const fresh = memoryCache && Date.now() - memoryCache.fetchedAt < TTL_MS;
  if (fresh) return Promise.resolve(memoryCache.itemIds);
  // Concurrent callers share one request instead of each firing their own.
  if (inFlight) return inFlight;

  inFlight = api
    .get("/inventory/item-ids")
    .then(({ data }) => {
      const itemIds = Array.isArray(data.itemIds) ? data.itemIds : [];
      memoryCache = { itemIds, fetchedAt: Date.now() };
      writeCache(memoryCache);
      return itemIds;
    })
    .catch(() => memoryCache?.itemIds || [])
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

export default function useKnownItemIds() {
  // Start from whatever is cached, so the list is populated on first paint.
  const [itemIds, setItemIds] = useState(() => memoryCache?.itemIds || []);

  useEffect(() => {
    let cancelled = false;
    loadItemIds().then((ids) => {
      if (!cancelled) setItemIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return itemIds;
}
