// Shared fallback for list endpoints when the underlying table hasn't been
// migrated yet on this deployment (Prisma error code P2021). Rather than each
// controller ad-hoc deciding whether to mask this as "no data" or let it 500,
// every list endpoint in the app treats it the same way: an empty result in
// whatever shape that endpoint normally returns.
export function isMissingTableError(error) {
  return error?.code === "P2021";
}

// For endpoints whose service returns a plain array when unpaginated and
// { items, pagination } when a limit is requested (enquiries, orders,
// production, manual order requests).
export function emptyPaginatedOrArrayFallback(req) {
  const limit = Number(req.query?.limit);
  if (Number.isFinite(limit) && limit > 0) {
    const page = Math.max(1, Number(req.query?.page) || 1);
    return { items: [], pagination: { page, limit, total: 0, totalPages: 1 } };
  }
  return [];
}
