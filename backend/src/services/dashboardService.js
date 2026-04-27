import prisma from "../config/prisma.js";
import { buildCacheKey, getOrLoadCached, invalidateCacheByPrefix } from "../utils/responseCache.js";

const DASHBOARD_CACHE_PREFIX = "dashboard:summary";
const DASHBOARD_CACHE_TTL_MS = 10 * 1000;

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthBuckets() {
  const now = new Date();
  const buckets = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    buckets.push({
      key: monthKey(monthDate),
      month: monthDate.toLocaleDateString(undefined, { month: "short" }),
      enquiries: 0,
      orders: 0
    });
  }

  return buckets;
}

function getDashboardWindowStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - 5, 1);
}

function applyMonthlyCounts(buckets, rows = [], field) {
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  rows.forEach((row) => {
    const key = String(row.monthKey || "").trim();
    const bucket = bucketMap.get(key);
    if (!bucket) return;
    bucket[field] = Number(row.total || 0);
  });
}

export function invalidateDashboardSummaryCache() {
  invalidateCacheByPrefix(DASHBOARD_CACHE_PREFIX);
}

export async function getDashboardSummary() {
  const cacheKey = buildCacheKey(DASHBOARD_CACHE_PREFIX, { scope: "summary" });

  return getOrLoadCached(cacheKey, DASHBOARD_CACHE_TTL_MS, async () => {
    const buckets = buildMonthBuckets();
    const startDate = getDashboardWindowStart();

    const [
      totalEnquiries,
      pendingApprovals,
      totalOrders,
      createdOrders,
      inProductionOrders,
      readyForDispatchOrders,
      partiallyDispatchedOrders,
      completedOrders,
      enquiryTrendRows,
      orderTrendRows
    ] = await Promise.all([
      prisma.enquiry.count(),
      prisma.enquiry.count({ where: { status: "PENDING" } }),
      prisma.order.count(),
      prisma.order.count({ where: { status: "CREATED" } }),
      prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      prisma.order.count({ where: { status: "READY_FOR_DISPATCH" } }),
      prisma.order.count({ where: { status: "PARTIALLY_DISPATCHED" } }),
      prisma.order.count({ where: { status: "COMPLETED" } }),
      prisma.$queryRaw`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') AS monthKey, COUNT(*) AS total
        FROM \`Enquiry\`
        WHERE createdAt >= ${startDate}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY monthKey ASC
      `,
      prisma.$queryRaw`
        SELECT DATE_FORMAT(createdAt, '%Y-%m') AS monthKey, COUNT(*) AS total
        FROM \`Order\`
        WHERE createdAt >= ${startDate}
        GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
        ORDER BY monthKey ASC
      `
    ]);

    applyMonthlyCounts(buckets, enquiryTrendRows, "enquiries");
    applyMonthlyCounts(buckets, orderTrendRows, "orders");

    return {
      counts: {
        totalEnquiries,
        pendingApprovals,
        totalOrders,
        createdOrders,
        inProductionOrders,
        readyForDispatchOrders,
        partiallyDispatchedOrders,
        completedOrders,
      },
      trendData: buckets,
      statusMix: [
        { label: "Created", value: createdOrders, color: "#2563eb" },
        { label: "In Production", value: inProductionOrders, color: "#ea580c" },
        { label: "Ready for Dispatch", value: readyForDispatchOrders, color: "#7c3aed" },
        { label: "Partially Dispatched", value: partiallyDispatchedOrders, color: "#16a34a" },
        { label: "Completed", value: completedOrders, color: "#0f766e" }
      ]
    };
  });
}
