import { useEffect, useRef, useState } from "react";
import api from "../api/axiosClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { getApprovalListParams, normalizeApprovalStatus } from "../utils/approvalFilters";
import { exportRowsToExcel } from "../utils/exportExcel";
import { getDisplayEnquiryNumber, getDisplayManualOrderRequestNumber } from "../utils/businessNumbers";
import { formatPriceValue } from "../utils/commerce";
import { formatEnquiryProductNames } from "../utils/enquiryProducts";
import { sortByNewestFirst } from "../utils/recordOrdering";

const approvalTabs = [
  { label: "All", value: "ALL" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" }
];

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="approval-card-calendar-icon" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M7 3.5v4M17 3.5v4M3.5 9.5h17" />
    </svg>
  );
}

function ApprovalPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const canApprove = user?.role === "admin" || user?.role === "sales";
  const fetchSeqRef = useRef(0);

  // Rejecting asks for a reason in a modal. window.prompt() used to do this, but
  // browsers can suppress it outright — and a suppressed prompt reads as a
  // cancel, so Reject silently did nothing.
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const closeRejectModal = () => {
    if (rejecting) return;
    setRejectTarget(null);
    setRejectReason("");
    setRejectError("");
  };

  const submitRejection = async (event) => {
    event.preventDefault();
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("A reason is required to reject.");
      return;
    }

    setRejecting(true);
    try {
      await updateStatus(rejectTarget, "REJECTED", reason);
      setRejectTarget(null);
      setRejectReason("");
      setRejectError("");
    } finally {
      setRejecting(false);
    }
  };

  const fetchItems = async ({ silent = false } = {}) => {
    const requestId = ++fetchSeqRef.current;
    if (!silent) {
      setLoading(true);
    }
    try {
      const cacheBust = Date.now();
      const { enquiryParams, manualParams } = getApprovalListParams(statusFilter);
      const [enquiriesRes, manualRes] = await Promise.all([
        api.get("/enquiries", { params: { ...enquiryParams, _: cacheBust } }),
        api.get("/manual-orders", { params: { ...manualParams, _: cacheBust } })
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
          products: formatEnquiryProductNames(enquiry) || enquiry.product || "-",
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
          products: request.product || "-",
          raw: request
        }))
      ];

      const filtered = sortByNewestFirst(combined).filter((item) => {
        if (statusFilter === "ALL") return true;
        return normalizeApprovalStatus(item.source, item.raw.status) === statusFilter;
      });

      // Ignore this response if a newer request has since been kicked off
      // (e.g. the user switched tabs while a poll/focus refresh for the
      // previous tab was still in flight) — otherwise stale data can
      // silently overwrite what's currently selected.
      if (requestId !== fetchSeqRef.current) return;
      setItems(filtered);
    } catch (error) {
      if (requestId !== fetchSeqRef.current) return;
      logApiError(error, "Failed to load approval items");
      setItems([]);
    } finally {
      if (!silent && requestId === fetchSeqRef.current) {
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

  // A rejection has to say why — it's the only record of the decision — so the
  // reason arrives from the modal rather than being collected here.
  const updateStatus = async (item, nextStatus, rejectionReason = null) => {
    if (!canApprove) return;
    if (nextStatus === "REJECTED" && !String(rejectionReason || "").trim()) return;

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
        await api.put(`/manual-orders/${item.id}/status`, {
          status: apiStatus,
          ...(rejectionReason ? { rejection_reason: rejectionReason } : {})
        });
      } else {
        await api.put(`/enquiries/${item.id}`, {
          status: nextStatus,
          ...(rejectionReason ? { rejection_reason: rejectionReason } : {})
        });
      }

      await fetchItems({ silent: true });
    } catch (error) {
      setItems(previousItems);
      logApiError(error, "Update failed");
    }
  };

  const exportToExcel = () => {
    const columns = [
      { key: "businessNumber", header: "Reference No" },
      { key: "type",           header: "Type" },
      { key: "clientName",     header: "Client" },
      { key: "products",       header: "Products" },
      { key: "quantity",       header: "Quantity" },
      { key: "price",          header: "Price" },
      { key: "currency",       header: "Currency" },
      { key: "expectedDate",   header: "Expected Date" },
      { key: "status",         header: "Status" },
      { key: "createdAt",      header: "Created" }
    ];
    const rows = items.map((item) => ({
      businessNumber: item.businessNumber || "-",
      type:           item.source === "manual" ? "Manual Order Request" : "Enquiry",
      clientName:     item.clientName || "-",
      products:       item.products || "-",
      quantity:       item.quantity ?? "-",
      price:          item.price ?? "-",
      currency:       item.currency || "-",
      expectedDate:   formatDate(item.expectedDate),
      status:         normalizeApprovalStatus(item.source, item.raw.status),
      createdAt:      formatDate(item.createdAt)
    }));
    exportRowsToExcel("approvals", columns, rows);
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Approval</h2>
            <button className="order-btn-secondary" onClick={exportToExcel}>
              Export to Excel
            </button>
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
                  {/* The currency belongs to the price, not beside it — a tile
                      holding only "EUR" is a label taking the space of a figure. */}
                  <div className="approval-request-tile">
                    <p>Price</p>
                    <strong>
                      {formatPriceValue(item.price)}
                      {item.currency ? <span className="approval-tile-unit"> {item.currency}</span> : null}
                    </strong>
                  </div>
                </div>

                {item.raw?.rejectionReason && (
                  <div className="approval-reject-reason">
                    <strong>Rejected:</strong> {item.raw.rejectionReason}
                  </div>
                )}

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
                        onClick={() => {
                          setRejectTarget(item);
                          setRejectReason("");
                          setRejectError("");
                        }}
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

      {rejectTarget && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card approval-reject-modal">
            <div className="approval-reject-head">
              <div>
                <h3>Reject Request</h3>
                <p>
                  {rejectTarget.businessNumber || "This request"}
                  {rejectTarget.clientName ? ` — ${rejectTarget.clientName}` : ""}
                </p>
              </div>
              <button className="approval-reject-close" onClick={closeRejectModal} disabled={rejecting} type="button" aria-label="Close">
                ✕
              </button>
            </div>

            <form onSubmit={submitRejection}>
              <div className="approval-reject-body">
                <label htmlFor="reject-reason">Reason for rejection <span>*</span></label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  autoFocus
                  value={rejectReason}
                  onChange={(e) => { setRejectReason(e.target.value); setRejectError(""); }}
                  placeholder="Why is this being rejected?"
                />
                <p className="approval-reject-hint">
                  Saved against the record and shown to the sales team.
                </p>
                {rejectError && <p className="approval-reject-error">{rejectError}</p>}
              </div>

              <div className="approval-reject-actions">
                <button type="button" className="masterdata-btn-secondary" onClick={closeRejectModal} disabled={rejecting}>
                  Cancel
                </button>
                <button type="submit" className="approval-btn-danger" disabled={rejecting}>
                  {rejecting ? "Rejecting..." : "Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalPage;
