export function parsePositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildPagination(query = {}, { defaultLimit = 0, maxLimit = 100 } = {}) {
  const page = parsePositiveInt(query.page, 1);
  const requestedLimit = parsePositiveInt(query.limit, defaultLimit);
  const limit = requestedLimit > 0 ? Math.min(requestedLimit, maxLimit) : 0;

  if (!limit) {
    return { page: 1, limit: 0, skip: 0, take: 0 };
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit
  };
}
