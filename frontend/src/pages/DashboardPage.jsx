import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import ErpCard from "../components/erp/ErpCard";
import { BoxesIcon, CheckIcon, CircleCheckIcon, ClipboardIcon, FactoryIcon, HomeIcon, HourglassIcon, InboxIcon, TruckIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";

const actions = [
  { title: "Manage Enquiries", desc: "Create and track all enquiry requests.", to: "/enquiries", icon: <InboxIcon />, tone: "primary", roles: ["admin", "sales", "production", "dispatch"] },
  { title: "Approvals", desc: "Review and approve pending enquiries.", to: "/approval", icon: <CheckIcon />, tone: "warning", roles: ["admin"] },
  { title: "Orders", desc: "Convert accepted enquiries into orders.", to: "/orders", icon: <BoxesIcon />, tone: "primary", roles: ["admin", "sales", "production", "dispatch"] },
  { title: "Production", desc: "Start and monitor production execution.", to: "/production", icon: <FactoryIcon />, tone: "success", roles: ["admin", "sales", "production", "dispatch"] },
  { title: "Dispatch", desc: "Ship completed orders and update status.", to: "/dispatch", icon: <TruckIcon />, tone: "danger", roles: ["admin", "sales", "production", "dispatch"] }
];

function getDateFromRecord(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (!value) continue;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function DashboardPage() {
  const { user } = useAuth();
  const [enquiries, setEnquiries] = useState([]);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [enquiriesRes, ordersRes] = await Promise.all([
          api.get("/enquiries"),
          api.get("/orders")
        ]);
        setEnquiries(enquiriesRes.data || []);
        setOrders(ordersRes.data || []);
      } catch (error) {
        logApiError(error, "Failed to load dashboard data");
      }
    };

    fetchDashboardData();
  }, []);

  const stats = useMemo(() => {
    const pendingApprovals = enquiries.filter((item) => item.status === "PENDING").length;
    const inProduction = orders.filter((item) => item.status === "IN_PRODUCTION").length;
    const dispatched = orders.filter((item) => item.status === "DISPATCHED").length;

    return [
      { label: "Total Enquiries", value: enquiries.length, accent: "blue", icon: <ClipboardIcon /> },
      { label: "Pending Approvals", value: pendingApprovals, accent: "orange", icon: <HourglassIcon /> },
      { label: "In Production", value: inProduction, accent: "purple", icon: <FactoryIcon /> },
      { label: "Dispatched Orders", value: dispatched, accent: "green", icon: <CircleCheckIcon /> }
    ];
  }, [enquiries, orders]);

  const trendData = useMemo(() => {
    const buckets = [];
    const bucketMap = new Map();
    const now = new Date();

    for (let offset = 5; offset >= 0; offset -= 1) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
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
      const date = getDateFromRecord(item, ["createdAt", "enquiryDate"]);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = bucketMap.get(key);
      if (bucket) bucket.enquiries += 1;
    });

    orders.forEach((item) => {
      const date = getDateFromRecord(item, ["createdAt", "orderDate"]);
      if (!date) return;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const bucket = bucketMap.get(key);
      if (bucket) bucket.orders += 1;
    });

    return buckets;
  }, [enquiries, orders]);

  const statusMix = useMemo(() => {
    const created = orders.filter((item) => item.status === "CREATED").length;
    const inProduction = orders.filter((item) => item.status === "IN_PRODUCTION").length;
    const completed = orders.filter((item) => item.status === "COMPLETED").length;
    const dispatched = orders.filter((item) => item.status === "DISPATCHED").length;

    return [
      { label: "Created", value: created, color: "#2563eb" },
      { label: "In Production", value: inProduction, color: "#ea580c" },
      { label: "Completed", value: completed, color: "#7c3aed" },
      { label: "Dispatched", value: dispatched, color: "#16a34a" }
    ];
  }, [orders]);

  const maxTrendValue = Math.max(1, ...trendData.flatMap((item) => [item.enquiries, item.orders]));
  const totalStatus = Math.max(1, statusMix.reduce((sum, item) => sum + item.value, 0));

  return (
    <div className="erp-dashboard">
      <section className="erp-panel">
        <div className="erp-welcome">
          <div className="erp-welcome-icon"><HomeIcon /></div>
          <div>
            <h2>Hey, {user.name || "Admin User"}</h2>
          </div>
        </div>
        <span className="erp-role-badge">{(user.role || "admin").toUpperCase()}</span>
      </section>

      <section className="erp-stats-grid">
        {stats.map((card) => (
          <ErpCard key={card.label} icon={card.icon} value={card.value} label={card.label} accent={card.accent} />
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