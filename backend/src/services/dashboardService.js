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

function ratio(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

// Enquiry conversion, in two parts — because `stage` (sales progress) and
// `status` (the approval decision) are independent in this system. An enquiry
// can be approved while still sitting at GENERAL, having never been sampled or
// quoted. Chaining them into one funnel produces ratios above 100% (approved
// enquiries outnumbering quoted ones), which is meaningless, so they are
// reported separately:
//
//   stageFunnel  — sales progression, each step as a share of the one before,
//                  which is where the real drop-off shows.
//   outcomeMix   — what actually became of the enquiries, each as a share of
//                  all of them.
//
// "Sampled" counts enquiries that ever reached sampling, not just those parked
// there now: sampledAt is stamped on first entry to SAMPLED, and anything now
// QUOTED must have passed through it.
function buildStageFunnel({ totalEnquiries, everSampled, quoted }) {
  const steps = [
    { key: "ENQUIRY", label: "Enquiries", count: totalEnquiries },
    { key: "SAMPLED", label: "Sampled", count: everSampled },
    { key: "QUOTED", label: "Quoted", count: quoted }
  ];

  return steps.map((step, index) => {
    const previous = index === 0 ? null : steps[index - 1];
    return {
      ...step,
      conversionFromPrevious: previous ? ratio(step.count, previous.count) : 100,
      conversionFromStart: ratio(step.count, totalEnquiries)
    };
  });
}

function buildOutcomeMix({ totalEnquiries, approved, rejected, pending, ordered }) {
  return [
    { key: "APPROVED", label: "Approved", count: approved, share: ratio(approved, totalEnquiries), color: "#16a34a" },
    { key: "PENDING", label: "Awaiting Decision", count: pending, share: ratio(pending, totalEnquiries), color: "#ea580c" },
    { key: "REJECTED", label: "Rejected", count: rejected, share: ratio(rejected, totalEnquiries), color: "#dc2626" },
    { key: "ORDER", label: "Order Created", count: ordered, share: ratio(ordered, totalEnquiries), color: "#2563eb" }
  ];
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
      convertedEnquiries,
      generalStageEnquiries,
      sampledStageEnquiries,
      quotedStageEnquiries,
      everSampledEnquiries,
      approvedEnquiries,
      rejectedEnquiries,
      approvedWithOrderEnquiries,
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
      // Orders that originated from an enquiry — the numerator for the
      // enquiry-to-order conversion ratio.
      prisma.order.count({ where: { enquiryId: { not: null } } }),
      // Current stage distribution.
      prisma.enquiry.count({ where: { stage: "GENERAL" } }),
      prisma.enquiry.count({ where: { stage: "SAMPLED" } }),
      prisma.enquiry.count({ where: { stage: "QUOTED" } }),
      // "Ever sampled": sampledAt is stamped on first entry to SAMPLED, but an
      // enquiry quoted straight after sampling may predate that column, so
      // treat a QUOTED stage as having been sampled too.
      prisma.enquiry.count({
        where: { OR: [{ sampledAt: { not: null } }, { stage: { in: ["SAMPLED", "QUOTED"] } }] }
      }),
      prisma.enquiry.count({ where: { status: "ACCEPTED" } }),
      prisma.enquiry.count({ where: { status: "REJECTED" } }),
      // Approved enquiries that actually produced an order. Not the same as
      // "orders from enquiries": an urgent enquiry auto-creates its order while
      // its status stays PENDING, so orders can outnumber approvals.
      prisma.enquiry.count({ where: { status: "ACCEPTED", order: { isNot: null } } }),
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

    // Enquiry-to-order conversion ratio (percentage, one decimal place).
    const conversionRate = totalEnquiries > 0
      ? Math.round((convertedEnquiries / totalEnquiries) * 1000) / 10
      : 0;

    const stageFunnel = buildStageFunnel({
      totalEnquiries,
      everSampled: everSampledEnquiries,
      quoted: quotedStageEnquiries
    });

    const outcomeMix = buildOutcomeMix({
      totalEnquiries,
      approved: approvedEnquiries,
      rejected: rejectedEnquiries,
      pending: pendingApprovals,
      ordered: convertedEnquiries
    });

    // Of the enquiries that were approved, how many became an order. Measured
    // against approved-enquiries-with-an-order rather than all enquiry-linked
    // orders, otherwise urgent enquiries (which skip approval but still create
    // an order) push this above 100%.
    const approvedToOrderRate = ratio(approvedWithOrderEnquiries, approvedEnquiries);

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
        convertedEnquiries,
        conversionRate,
        generalStageEnquiries,
        sampledStageEnquiries,
        quotedStageEnquiries,
        approvedEnquiries,
        rejectedEnquiries,
        approvedToOrderRate
      },
      // Sales progression (Enquiries → Sampled → Quoted), each step as a share
      // of the previous one.
      stageFunnel,
      // What became of the enquiries, each as a share of all of them.
      outcomeMix,
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
