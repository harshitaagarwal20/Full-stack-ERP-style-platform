import api from "../api/axiosClient";

// A phone only loads the last 45 days. Desktop omits this and sees everything.
// Keeps a mobile list to a small, indexed slice of the table instead of years of
// history dragged over a mobile connection.
export const MOBILE_RECENT_DAYS = 45;

// Filter params to merge into a list request. Pass the isMobile flag.
export function windowParams(isMobile) {
  return isMobile ? { recent_days: MOBILE_RECENT_DAYS } : {};
}

// Export used to ask the API for `limit: 0` — every row in one response. With
// 10,000 rows that is a huge payload to build, cache and parse, and it will kill
// a phone. Page through instead, in bounded chunks, and stop at a hard ceiling
// so a runaway table can never exhaust the browser's memory.
const EXPORT_PAGE_SIZE = 200;
const EXPORT_MAX_ROWS = 5000;

export async function fetchAllPages(url, params = {}, { maxRows = EXPORT_MAX_ROWS } = {}) {
  const rows = [];

  for (let page = 1; ; page += 1) {
    const { data } = await api.get(url, {
      params: { ...params, page, limit: EXPORT_PAGE_SIZE }
    });

    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    rows.push(...items);

    const totalPages = Number(data?.pagination?.totalPages || 1);
    if (items.length < EXPORT_PAGE_SIZE || page >= totalPages || rows.length >= maxRows) {
      break;
    }
  }

  return rows.slice(0, maxRows);
}
