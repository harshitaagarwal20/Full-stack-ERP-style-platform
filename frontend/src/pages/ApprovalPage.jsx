import { useEffect, useState } from "react";
import api from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { getDisplayEnquiryNumber, getDisplayManualOrderRequestNumber } from "../utils/businessNumbers";
import { formatPriceValue } from "../utils/commerce";
import { formatEnquiryProducts } from "../utils/enquiryProducts";

const approvalTabs = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" }
];

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="approval-card-calendar-icon" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
    </svg>
  );
}

function normalizeApprovalStatus(source, status) {
  if (source === "manual") {
    if (status === "REQUESTED") return "PENDING";
    if (status === "APPROVED" || status === "ORDER_CREATED") return "ACCEPTED";
    if (status === "REJECTED") return "REJECTED";
  }
  return status || "PENDING";
}

function ApprovalPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const canApprove = user?.role === "admin";

  const fetchItems = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const cacheBust = Date.now();
      const [enquiriesRes, manualRes] = await Promise.all([
        api.get("/enquiries", { params: { _: cacheBust } }),
        api.get("/manual-orders", { params: { _: cacheBust } })
      ]);

      const enquiryItems = Array.isArray(enquiriesRes.data)
        ? enquiriesRes.data
        : Array.isArray(enquiriesRes.data?.items)
          ? enquiriesRes.data.items
          : [];
      const manualItems = Array.isArray(manualRes.data?.items)
        ? manualRes.data.items
        : Array.isArray(manualRes.data)
          ? manualRes.data
          : [];

      const combined = [
        ...enquiryItems.map((enquiry) => ({
          source: "enquiry",
          id: enquiry.id,
          clientName: enquiry.companyName,
          businessNumber: getDisplayEnquiryNumber(enquiry),
          status: enquiry.status,
          createdAt: enquiry.createdAt,
          expectedDate: enquiry.expectedTimeline,
          quantity: enquiry.quantity,
          products: formatEnquiryProducts(enquiry) || enquiry.product || "-",
          price: enquiry.price,
          currency: enquiry.currency,
          raw: enquiry
        })),
        ...manualItems.map((request) => ({
          source: "manual",
          id: request.id,
          clientName: request.clientName,
          businessNumber: getDisplayManualOrderRequestNumber(request),
          status: normalizeApprovalStatus("manual", request.status),
          createdAt: request.createdAt,
          expectedDate: request.dispatchDate,
          quantity: request.quantity,
          products: formatEnquiryProducts([{
            product: request.product,
            grade: request.grade,
            quantity: request.quantity,
            unit_of_measurement: request.unit
          }]) || request.product || "-",
          raw: request
        }))
      ];

      combined.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

      const filtered = combined.filter((item) => {
        if (statusFilter === "ALL") return true;
        return normalizeApprovalStatus(item.source, item.raw.status) === statusFilter;
      });

      setItems(filtered);
    } catch (error) {
      logApiError(error, "Failed to load approval items");
      setItems([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchItems();

    const handleFocus = () => {
      fetchItems({ silent: true });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchItems({ silent: true });
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const refreshTimer = window.setInterval(() => fetchItems({ silent: true }), 15000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(refreshTimer);
    };
  }, [statusFilter]);

  const updateStatus = async (item, nextStatus) => {
    if (!canApprove) return;

    const optimisticStatus = normalizeApprovalStatus(item.source, nextStatus === "ACCEPTED" ? (item.source === "manual" ? "APPROVED" : "ACCEPTED") : "REJECTED");
    const shouldRemoveFromCurrentView = statusFilter === "PENDING";
    const previousItems = items;

    setItems((currentItems) => {
      if (shouldRemoveFromCurrentView) {
        return currentItems.filter((current) => !(current.source === item.source && current.id === item.id));
      }

      return currentItems.map((current) =>
        current.source === item.source && current.id === item.id
          ? {
              ...current,
              status: optimisticStatus,
              raw: {
                ...current.raw,
                status: item.source === "manual" && nextStatus === "ACCEPTED" ? "APPROVED" : nextStatus
              }
            }
          : current
      );
    });

    try {
      if (item.source === "manual") {
        const apiStatus = nextStatus === "ACCEPTED" ? "APPROVED" : "REJECTED";
        await api.put(`/manual-orders/${item.id}/status`, { status: apiStatus });
      } else {
        await api.put(`/enquiries/${item.id}`, { status: nextStatus });
      }

      await fetchItems({ silent: true });
    } catch (error) {
      setItems(previousItems);
      logApiError(error, "Update failed");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Approval</h2>
            
          </div>
          <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-1 lg:w-auto">
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {approvalTabs.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                    statusFilter === tab.value
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {loading ? (
          <div className="py-10"><LoadingSpinner /></div>
        ) : items.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <article
                key={`${item.source}-${item.id}`}
                className="approval-request-card"
              >
                <div className="approval-request-card-head">
                  <div className="min-w-0">
                    <div className="approval-request-card-title-row">
                      <h4 className="truncate">{item.clientName || "Unknown Client"}</h4>
                      <span className={`approval-status-badge ${item.source === "manual" ? "manual" : "enquiry"} ${normalizeApprovalStatus(item.source, item.raw.status).toLowerCase()}`}>
                        {normalizeApprovalStatus(item.source, item.raw.status)}
                      </span>
                    </div>
                    <p className="approval-request-number">{item.businessNumber}</p>
                    <p className="approval-request-type">
                      {item.source === "manual" ? "Manual Order Request" : "Enquiry"}
                    </p>
                  </div>
                </div>

                <div className="approval-request-card-meta">
                  <div className="approval-request-date">
                    <CalendarIcon />
                    <span>Expected: {formatDate(item.expectedDate)}</span>
                  </div>
                </div>

                <div className="approval-request-products">
                  <div className="approval-request-section-label">Products</div>
                  <div className="approval-request-product-list">
                    <div className="approval-request-product-main">
                      {item.products || "-"}
                    </div>
                  </div>
                </div>

                <div className="approval-request-tiles">
                  <div className="approval-request-tile">
                    <p>Quantity</p>
                    <strong>{item.quantity || "-"}</strong>
                  </div>
                  <div className="approval-request-tile">
                    <p>Price</p>
                    <strong>{formatPriceValue(item.price)}</strong>
                  </div>
                  <div className="approval-request-tile">
                    <p>Currency</p>
                    <strong>{item.currency || "-"}</strong>
                  </div>
                  <div className="approval-request-tile">
                    <p>Created</p>
                    <strong>{formatDate(item.createdAt)}</strong>
                  </div>
                </div>

                {canApprove && normalizeApprovalStatus(item.source, item.raw.status) === "PENDING" && (
                  <div className="approval-request-actions">
                    <div className="approval-request-divider" />
                    <div className="approval-request-buttons">
                      <button
                        className="approval-btn-primary"
                        onClick={() => updateStatus(item, "ACCEPTED")}
                      >
                        Approve
                      </button>
                      <button
                        className="approval-btn-danger"
                        onClick={() => updateStatus(item, "REJECTED")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
            No approval items found for this filter.
          </div>
        )}
      </section>
    </div>
  );
}

export default ApprovalPage;
