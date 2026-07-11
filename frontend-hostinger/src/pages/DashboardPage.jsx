import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import ErpCard from "../components/erp/ErpCard";
import { BoxesIcon, CheckIcon, ClipboardIcon, FactoryIcon, HomeIcon, HourglassIcon, InboxIcon, TruckIcon } from "../components/erp/ErpIcons";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { getFollowUpEnquiries } from "../utils/followUps";

const MOBILE_TILES = [
  { title: "New Enquiry", sub: "Log a lead", to: "/enquiries?new=1", icon: <InboxIcon />, v: "v1", roles: ["admin", "sales"] },
  { title: "New Order", sub: "Raise sales order", to: "/orders?new=1", icon: <BoxesIcon />, v: "v2", roles: ["admin", "sales"] },
  { title: "Production", sub: "Update jobs", to: "/production", icon: <FactoryIcon />, v: "v3", roles: ["admin"] },
  { title: "Approvals", sub: "Review pending", to: "/approval", icon: <CheckIcon />, v: "v4", roles: ["admin", "sales"] }
];

const actions = [
  { title: "Manage Enquiries", desc: "Create and track all enquiry requests.", to: "/enquiries", icon: <InboxIcon />, tone: "primary", roles: ["admin", "sales"] },
  { title: "Approvals", desc: "Review and approve pending enquiries.", to: "/approval", icon: <CheckIcon />, tone: "warning", roles: ["admin", "sales"] },
  { title: "Orders", desc: "Convert accepted enquiries into orders.", to: "/orders", icon: <BoxesIcon />, tone: "primary", roles: ["admin", "sales"] },
  { title: "Production", desc: "Start and monitor production execution.", to: "/production", icon: <FactoryIcon />, tone: "success", roles: ["admin"] },
  { title: "Dispatch", desc: "Ship completed orders and update status.", to: "/dispatch", icon: <TruckIcon />, tone: "danger", roles: ["admin"] }
];

function normalizeDashboardSummary(data) {
  const counts = data?.counts || {};
  return {
    counts: {
      totalEnquiries: Number(counts.totalEnquiries || 0),
      pendingApprovals: Number(counts.pendingApprovals || 0),
      totalOrders: Number(counts.totalOrders || 0),
      createdOrders: Number(counts.createdOrders || 0),
      inProductionOrders: Number(counts.inProductionOrders || 0),
      readyForDispatchOrders: Number(counts.readyForDispatchOrders || 0),
      partiallyDispatchedOrders: Number(counts.partiallyDispatchedOrders || 0),
      completedOrders: Number(counts.completedOrders || 0),
    },
    trendData: Array.isArray(data?.trendData) ? data.trendData : [],
    statusMix: Array.isArray(data?.statusMix) ? data.statusMix : []
  };
}

function buildSummaryFromLists(enquiries = [], orders = []) {
  const buckets = [];
  const bucketMap = new Map();
  const now = new Date();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
    const bucket = {
      key,
      month: monthDate.toLocaleDateString(undefined, { month: "short" }),
      enquiries: 0,
      orders: 0
    };
    buckets.push(bucket);
    bucketMap.set(key, bucket);
  }

  enquiries.forEach((item) => {
    const rawDate = item?.createdAt || item?.enquiryDate;
    const parsed = rawDate ? new Date(rawDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);
    if (bucket) bucket.enquiries += 1;
  });

  orders.forEach((item) => {
    const rawDate = item?.createdAt || item?.orderDate;
    const parsed = rawDate ? new Date(rawDate) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return;
    const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
    const bucket = bucketMap.get(key);
    if (bucket) bucket.orders += 1;
  });

  const pendingApprovals = enquiries.filter((item) => item.status === "PENDING").length;
  const orderStatusCounts = orders.reduce((acc, item) => {
    const status = item?.status;
    if (status === "CREATED") acc.createdOrders += 1;
    else if (status === "IN_PRODUCTION") acc.inProductionOrders += 1;
    else if (status === "READY_FOR_DISPATCH") acc.readyForDispatchOrders += 1;
    else if (status === "PARTIALLY_DISPATCHED") acc.partiallyDispatchedOrders += 1;
    else if (status === "COMPLETED" || status === "DISPATCHED") acc.completedOrders += 1;
    return acc;
  }, {
    createdOrders: 0,
    inProductionOrders: 0,
    readyForDispatchOrders: 0,
    partiallyDispatchedOrders: 0,
    completedOrders: 0
  });

  return {
    counts: {
      totalEnquiries: enquiries.length,
      pendingApprovals,
      totalOrders: orders.length,
      createdOrders: orderStatusCounts.createdOrders,
      inProductionOrders: orderStatusCounts.inProductionOrders,
      readyForDispatchOrders: orderStatusCounts.readyForDispatchOrders,
      partiallyDispatchedOrders: orderStatusCounts.partiallyDispatchedOrders,
      completedOrders: orderStatusCounts.completedOrders,
    },
    trendData: buckets,
    statusMix: [
      { label: "Created", value: orderStatusCounts.createdOrders, color: "#2563eb" },
      { label: "In Production", value: orderStatusCounts.inProductionOrders, color: "#ea580c" },
      { label: "Ready for Dispatch", value: orderStatusCounts.readyForDispatchOrders, color: "#7c3aed" },
      { label: "Partially Dispatched", value: orderStatusCounts.partiallyDispatchedOrders, color: "#16a34a" },
      { label: "Completed", value: orderStatusCounts.completedOrders, color: "#0f766e" }
    ]
  };
}

function normalizeListResponse(data) {
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function DashboardPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState(() => normalizeDashboardSummary());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followUps, setFollowUps] = useState([]);

  // Sampled enquiries that have gone quiet for 12+ days. Sales/admin only —
  // production and dispatch users have no use for this.
  useEffect(() => {
    if (user?.role !== "admin" && user?.role !== "sales") return;
    api
      .get("/enquiries")
      .then(({ data }) => setFollowUps(getFollowUpEnquiries(normalizeListResponse(data))))
      .catch(() => setFollowUps([]));
  }, [user?.role]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get("/dashboard/summary");
        setSummary(normalizeDashboardSummary(data));
      } catch (error) {
        try {
          const [enquiriesRes, ordersRes] = await Promise.all([
            api.get("/enquiries"),
            api.get("/orders")
          ]);
          const enquiries = normalizeListResponse(enquiriesRes.data);
          const orders = normalizeListResponse(ordersRes.data);
          setSummary(buildSummaryFromLists(enquiries, orders));
        } catch (fallbackError) {
          setError("Failed to load dashboard data.");
          logApiError(fallbackError, "Failed to load dashboard data");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    const counts = summary.counts;

    return [
      { label: "Total Enquiries", value: counts.totalEnquiries, accent: "blue", icon: <ClipboardIcon /> },
      { label: "Pending Approvals", value: counts.pendingApprovals, accent: "orange", icon: <HourglassIcon /> },
      { label: "In Production", value: counts.inProductionOrders, accent: "purple", icon: <FactoryIcon /> },
      { label: "Ready for Dispatch", value: counts.readyForDispatchOrders, accent: "green", icon: <TruckIcon /> }
    ];
  }, [summary.counts]);

  const trendData = summary.trendData;
  const statusMix = summary.statusMix;

  const maxTrendValue = Math.max(1, ...trendData.flatMap((item) => [item.enquiries, item.orders]));
  const totalStatus = Math.max(1, statusMix.reduce((sum, item) => sum + item.value, 0));

  if (isMobile) {
    const counts = summary.counts;
    const firstName = (user?.name || "there").trim().split(/\s+/)[0];
    const initials = (user?.name || "U").trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
    const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
    const tiles = MOBILE_TILES.filter((tile) => tile.roles.includes(user?.role));
    const needs = [
      { label: "Sampled — follow up", value: followUps.length, to: "/enquiries", tone: "warn", roles: ["admin", "sales"] },
      { label: "Pending approvals", value: counts.pendingApprovals, to: "/approval", tone: "warn", roles: ["admin", "sales"] },
      { label: "In production", value: counts.inProductionOrders, to: "/production", tone: "info", roles: ["admin"] },
      { label: "Ready for dispatch", value: counts.readyForDispatchOrders, to: "/dispatch", tone: "ok", roles: ["admin"] }
    ].filter((item) => item.roles.includes(user?.role) && item.value > 0);

    return (
      <div className="today-mobile">
        <div className="today-hero">
          <div>
            <p className="today-date">{today}</p>
            <h2 className="today-hi">Hi, {firstName} 👋</h2>
          </div>
          <div className="today-avatar">{initials}</div>
        </div>

        {error && (
          <div className="today-empty" style={{ borderColor: "#fecaca", background: "#fff7f7", color: "#b91c1c" }}>
            {error}
          </div>
        )}

        <p className="today-sec">Quick actions</p>
        <div className="today-tiles">
          {tiles.map((tile) => (
            <Link key={tile.title} to={tile.to} className={`today-tile ${tile.v}`}>
              <span className="today-tile-ic">{tile.icon}</span>
              <span>
                <span className="today-tile-t" style={{ display: "block" }}>{tile.title}</span>
                <span className="today-tile-s">{tile.sub}</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="today-sec">Needs your input</p>
        {loading ? (
          <div className="today-empty">Loading…</div>
        ) : needs.length === 0 ? (
          <div className="today-empty">You're all caught up. Nothing needs attention. ✅</div>
        ) : (
          <div className="today-needs">
            {needs.map((item) => (
              <Link key={item.label} to={item.to} className={`today-need ${item.tone}`}>
                <span className="today-need-dot" />
                <span className="today-need-label">{item.label}</span>
                <span className="today-need-count">{item.value}</span>
                <span className="today-need-chev">›</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="erp-dashboard">
      {error && (
        <section className="erp-panel" style={{ borderColor: "#fecaca", background: "#fff7f7" }}>
          <div className="erp-section-head">
            <h3>Dashboard load failed</h3>
            <p>{error}</p>
          </div>
        </section>
      )}

      {loading && (
        <section className="erp-panel">
          <div className="erp-section-head">
            <h3>Loading dashboard</h3>
            <p>Fetching summary data...</p>
          </div>
        </section>
      )}

      <section className="erp-stats-grid">
        {stats.map((card) => (
          <ErpCard key={card.label} icon={card.icon} value={card.value} label={card.label} accent={card.accent} size="lg" />
        ))}
      </section>

      <section className="erp-chart-grid">
        <article className="erp-panel">
          <div className="erp-section-head">
            <h3>Enquiry vs Order Trend</h3>
            <p>Last 6 months</p>
          </div>
          <div className="erp-chart-bars">
            {trendData.map((item) => (
              <div key={item.month} className="erp-chart-col">
                <div className="erp-chart-pair">
                  <span
                    className="erp-chart-bar enquiries"
                    style={{ height: `${Math.max((item.enquiries / maxTrendValue) * 140, 6)}px` }}
                    title={`Enquiries: ${item.enquiries}`}
                  />
                  <span
                    className="erp-chart-bar orders"
                    style={{ height: `${Math.max((item.orders / maxTrendValue) * 140, 6)}px` }}
                    title={`Orders: ${item.orders}`}
                  />
                </div>
                <span className="erp-chart-label">{item.month}</span>
              </div>
            ))}
          </div>
          <div className="erp-chart-legend">
            <span><i className="swatch enquiries" /> Enquiries</span>
            <span><i className="swatch orders" /> Orders</span>
          </div>
        </article>

        <article className="erp-panel">
          <div className="erp-section-head">
            <h3>Order Status Mix</h3>
            <p>Current distribution</p>
          </div>
          <div className="erp-status-list">
            {statusMix.map((item) => (
              <div key={item.label} className="erp-status-row">
                <div className="erp-status-title">
                  <i style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </div>
                <strong>{item.value}</strong>
                <div className="erp-status-track">
                  <span style={{ width: `${(item.value / totalStatus) * 100}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="erp-panel">
        <div className="erp-section-head">
          <h3>Quick Actions</h3>
        </div>
        <div className="erp-action-grid">
          {actions.filter((action) => action.roles.includes(user?.role)).map((action) => (
            <Link key={action.title} to={action.to} className={`erp-action-card ${action.tone}`}>
              <span className="erp-action-icon">{action.icon}</span>
              <h4>{action.title}</h4>
              <p>{action.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
export default DashboardPage;
