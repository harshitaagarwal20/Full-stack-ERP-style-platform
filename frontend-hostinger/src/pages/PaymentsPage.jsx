import { Fragment, useEffect, useState } from "react";
import api from "../api/axiosClient";
import { BoxesIcon, SearchIcon } from "../components/erp/ErpIcons";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import { exportRowsToExcel } from "../utils/exportExcel";
import { fetchAllPages, windowParams } from "../utils/listWindow";
import { useAuth } from "../context/AuthContext";
import { useIsMobile } from "../hooks/useIsMobile";
import MobileListCard from "../components/common/MobileListCard";
import AgingReport from "../components/payments/AgingReport";

const PAYMENT_FILTERS = [
  { value: "", label: "All payments" },
  { value: "PENDING", label: "Payment pending" },
  { value: "PARTIAL", label: "Part paid" },
  { value: "RECEIVED", label: "Paid" }
];

const PAYMENT_TYPE_OPTIONS = [
  { value: "FULL", label: "Full payment" },
  { value: "PARTIAL", label: "Partial payment" }
];

const PAYMENT_META = {
  PENDING:  { label: "Payment pending", className: "in-production", badgeColor: "orange" },
  PARTIAL:  { label: "Part paid",       className: "partial",       badgeColor: "blue" },
  RECEIVED: { label: "Paid",            className: "dispatched",    badgeColor: "green" }
};

// Accounts only watches orders that have actually shipped — nothing is owed
// before the goods leave.
const DISPATCHED_STATUSES = ["PARTIALLY_DISPATCHED", "DISPATCHED", "COMPLETED"];

// Local calendar date: toISOString() is UTC, which is already "tomorrow" (or
// still "yesterday") for part of every day in India.
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const emptyPaymentForm = () => ({
  dispatch_id: "",
  payment_type: "FULL",
  amount: "",
  received_date: today(),
  invoice_number: "",
  remarks: ""
});

const money = (value) =>
  value === null || value === undefined ? "-" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

const invoiceLabel = (invoice) => invoice.invoiceNumber || `Dispatch #${invoice.id} (no invoice no.)`;

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatMoney(order) {
  if (order.price === null || order.price === undefined) return "-";
  const total = Number(order.price) * Number(order.quantity || 0);
  if (!Number.isFinite(total)) return "-";
  return `${order.currency || ""} ${total.toLocaleString()}`.trim();
}

function PaymentsPage() {
  const { user } = useAuth();
  const canRecordPayment = ["admin", "accounts"].includes(user?.role);

  const isMobile = useIsMobile();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [activeOrder, setActiveOrder] = useState(null);
  const [form, setForm] = useState(emptyPaymentForm);
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [view, setView] = useState("orders");
  // Bumped after a payment is saved to force the list to reload.
  const [reloadToken, setReloadToken] = useState(0);

  // All filtering now happens server-side: the payments worklist is the dispatched
  // orders (optionally narrowed by payment status and search), paginated. Loading
  // the first 20 of *all* orders and filtering client-side silently hid any
  // dispatched order past that first page — the bug this replaces.
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/orders", {
          params: {
            status: DISPATCHED_STATUSES.join(","),
            ...(paymentFilter ? { payment_status: paymentFilter } : {}),
            ...(searchText.trim() ? { q: searchText.trim() } : {}),
            page: currentPage,
            ...windowParams(isMobile)
          }
        });
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setOrders(items);
        const pagination = data?.pagination || null;
        setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
        setTotalRecords(Number(pagination?.total ?? items.length));
      } catch (error) {
        if (!cancelled) logApiError(error, "Failed to load payments");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Debounced so typing in the search box doesn't fire a request per keystroke.
    const timer = setTimeout(run, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchText, paymentFilter, currentPage, isMobile, reloadToken]);

  // A changed filter should start again from the first page.
  useEffect(() => { setCurrentPage(1); }, [searchText, paymentFilter]);

  const displayOrders = orders;

  const loadInvoices = async (orderId) => {
    setInvoicesLoading(true);
    try {
      const { data } = await api.get(`/orders/${orderId}/invoices`);
      const list = Array.isArray(data) ? data : [];
      setInvoices(list);
      return list;
    } catch (error) {
      logApiError(error, "Failed to load invoices");
      return [];
    } finally {
      setInvoicesLoading(false);
    }
  };

  // Picks the invoice to pay and pre-fills what is still owed on it.
  const selectInvoice = (list, dispatchId, type) => {
    const invoice = list.find((item) => String(item.id) === String(dispatchId));
    setForm((prev) => ({
      ...prev,
      dispatch_id: dispatchId,
      invoice_number: "",
      amount: invoice && type === "FULL" && invoice.pending !== null ? String(invoice.pending) : ""
    }));
  };

  const openPaymentModal = async (order) => {
    setActiveOrder(order);
    setInvoices([]);
    setForm(emptyPaymentForm());
    const list = await loadInvoices(order.id);
    const firstOpen = list.find((invoice) => !invoice.settled);
    if (firstOpen) selectInvoice(list, String(firstOpen.id), "FULL");
  };

  const closePaymentModal = () => {
    if (saving) return;
    setActiveOrder(null);
    setInvoices([]);
    setForm(emptyPaymentForm());
    // Receipts booked in the dialog change the list's roll-up columns.
    setReloadToken((token) => token + 1);
  };

  const selectedInvoice = invoices.find((invoice) => String(invoice.id) === String(form.dispatch_id));

  const submitPayment = async (e) => {
    e.preventDefault();
    if (saving || !selectedInvoice) return;
    setSaving(true);
    try {
      await api.post(`/orders/${activeOrder.id}/payments`, {
        dispatch_id: selectedInvoice.id,
        payment_type: form.payment_type,
        amount: form.amount === "" ? null : Number(form.amount),
        received_date: form.received_date,
        invoice_number: !selectedInvoice.invoiceNumber && form.invoice_number.trim() ? form.invoice_number.trim() : null,
        remarks: form.remarks.trim() || null
      });
      dispatchUserMessage("Payment recorded.", { title: "Saved", variant: "success" });
      const list = await loadInvoices(activeOrder.id);
      const nextOpen = list.find((invoice) => !invoice.settled);
      setForm({ ...emptyPaymentForm(), payment_type: "FULL" });
      if (nextOpen) selectInvoice(list, String(nextOpen.id), "FULL");
    } catch (error) {
      logApiError(error, "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const removePayment = async (paymentId) => {
    if (saving || !window.confirm("Delete this payment entry?")) return;
    setSaving(true);
    try {
      await api.delete(`/orders/${activeOrder.id}/payments/${paymentId}`);
      const list = await loadInvoices(activeOrder.id);
      if (selectedInvoice) selectInvoice(list, String(selectedInvoice.id), form.payment_type);
    } catch (error) {
      logApiError(error, "Failed to delete payment");
    } finally {
      setSaving(false);
    }
  };

  const exportToExcel = async () => {
    const columns = [
      { key: "orderNo",       header: "Order No" },
      { key: "client",        header: "Client" },
      { key: "product",       header: "Product" },
      { key: "orderValue",    header: "Order Value" },
      { key: "orderStatus",   header: "Order Status" },
      { key: "paymentStatus", header: "Payment" },
      { key: "amount",        header: "Amount Received" },
      { key: "receivedOn",    header: "Received On" }
    ];
    // Export the whole filtered set, not just the page on screen — page through
    // the same server-side filters rather than the (now paginated) local list.
    let source;
    try {
      source = await fetchAllPages("/orders", {
        status: DISPATCHED_STATUSES.join(","),
        ...(paymentFilter ? { payment_status: paymentFilter } : {}),
        ...(searchText.trim() ? { q: searchText.trim() } : {})
      });
    } catch (error) {
      logApiError(error, "Failed to export payments");
      return;
    }
    const rows = source.map((order) => ({
      orderNo:       order.orderNo || "-",
      client:        order.clientName || "-",
      product:       order.product || "-",
      orderValue:    formatMoney(order),
      orderStatus:   order.status,
      paymentStatus: PAYMENT_META[order.paymentStatus || "PENDING"].label,
      amount:        order.amountReceived ?? "-",
      receivedOn:    formatDate(order.paymentReceivedAt)
    }));
    exportRowsToExcel("payments", columns, rows);
  };

  return (
    <div className="order-page">
      {/* HEADER */}
      <section className="order-card">
        <div className="order-header-card">
          <div className="order-header-left">
            <h2>Payments</h2>
          </div>
        </div>
      </section>

      <section className="order-card">
        <div style={{ display: "flex", gap: 8 }}>
          <button className={view === "orders" ? "masterdata-btn-primary" : "order-btn-secondary"} onClick={() => setView("orders")}>
            Orders
          </button>
          <button className={view === "aging" ? "masterdata-btn-primary" : "order-btn-secondary"} onClick={() => setView("aging")}>
            Aging Report
          </button>
        </div>
      </section>

      {view === "aging" && <AgingReport />}

      {view === "orders" && (<>
      {/* SEARCH + FILTERS + ACTIONS */}
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input
            autoComplete="off"
            placeholder="Search order, client or product..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div className="unified-filter-row">
          <SearchableSelect
            options={PAYMENT_FILTERS}
            value={paymentFilter}
            onChange={setPaymentFilter}
            placeholder="All payments"
          />
        </div>

        <div className="unified-actions">
          <button className="order-btn-secondary" onClick={exportToExcel}>Export to Excel</button>
        </div>
      </section>

      {/* LIST */}
      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="order-skeleton-row" />
            ))}
          </div>
        ) : displayOrders.length === 0 ? (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>Nothing awaiting payment</p>
            <p style={{ color: "#64748b", marginTop: 6 }}>
              Orders appear here once they have been dispatched.
            </p>
          </div>
        ) : (
          <>
            <div className="order-table-wrap">
              <div className="order-table-meta">
                {totalRecords} order{totalRecords !== 1 ? "s" : ""}
              </div>
              <table className="order-table">
                <thead>
                  <tr>
                    <th style={{ width: 44 }}>#</th>
                    <th>Order No</th>
                    <th>Client</th>
                    <th>Product</th>
                    <th style={{ textAlign: "right" }}>Order Value</th>
                    <th style={{ textAlign: "right" }}>Received</th>
                    <th>Payment</th>
                    <th>Received On</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {displayOrders.map((order, idx) => {
                    const status = order.paymentStatus || "PENDING";
                    return (
                      <tr key={order.id}>
                        <td style={{ color: "#94a3b8", fontSize: 12 }}>{idx + 1}</td>
                        <td style={{ fontWeight: 600, color: "#1d4ed8" }}>{order.orderNo || "-"}</td>
                        <td>{order.clientName || "-"}</td>
                        <td>{order.product || "-"}</td>
                        <td style={{ textAlign: "right" }}>{formatMoney(order)}</td>
                        <td style={{ textAlign: "right" }}>
                          {order.amountReceived === null || order.amountReceived === undefined
                            ? "-"
                            : Number(order.amountReceived).toLocaleString()}
                        </td>
                        <td>
                          <span className={`order-status ${PAYMENT_META[status].className}`}>
                            {PAYMENT_META[status].label}
                          </span>
                        </td>
                        <td>{formatDate(order.paymentReceivedAt)}</td>
                        <td>
                          {canRecordPayment ? (
                            <button className="order-btn-secondary" onClick={() => openPaymentModal(order)}>
                              Record Payment
                            </button>
                          ) : (
                            <span className="pack-cell-sub">Accounts only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isMobile && (
              <div className="order-mobile-list">
                {displayOrders.map((order) => {
                  const status = order.paymentStatus || "PENDING";
                  return (
                    <MobileListCard
                      key={order.id}
                      title={order.orderNo || "—"}
                      subtitle={order.clientName || "-"}
                      badge={PAYMENT_META[status].label}
                      badgeColor={PAYMENT_META[status].badgeColor}
                      fields={[
                        { label: "Product", value: order.product || "-" },
                        { label: "Order Value", value: formatMoney(order) },
                        {
                          label: "Received",
                          value: order.amountReceived === null || order.amountReceived === undefined
                            ? "-"
                            : Number(order.amountReceived).toLocaleString()
                        },
                        { label: "Received On", value: formatDate(order.paymentReceivedAt) }
                      ]}
                      onActionClick={canRecordPayment ? () => openPaymentModal(order) : undefined}
                      actionLabel="Record Payment"
                    />
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>
                  Page {currentPage} of {totalPages} · {totalRecords} order{totalRecords !== 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="order-btn-secondary" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button className="order-btn-secondary" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      </>)}

      {activeOrder && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card" style={{ width: "min(760px, 100%)", maxHeight: "92vh", overflowY: "auto" }}>
            <div className="masterdata-modal-head">
              <div>
                <h3>Record Payment</h3>
                <p>{activeOrder.orderNo} · {activeOrder.clientName} · {formatMoney(activeOrder)}</p>
              </div>
              <button className="masterdata-modal-close-btn" onClick={closePaymentModal} disabled={saving} type="button">
                ✕
              </button>
            </div>

            {invoicesLoading && invoices.length === 0 ? (
              <p style={{ padding: 16 }}>Loading invoices...</p>
            ) : invoices.length === 0 ? (
              <p style={{ padding: 16 }}>This order has no dispatches yet, so there is nothing to invoice.</p>
            ) : (
              <>
                <div className="order-table-wrap" style={{ marginBottom: 16 }}>
                  <table className="order-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                        <th style={{ textAlign: "right" }}>Received</th>
                        <th style={{ textAlign: "right" }}>Pending</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <Fragment key={invoice.id}>
                          <tr>
                            <td style={{ fontWeight: 600 }}>{invoiceLabel(invoice)}</td>
                            <td>{formatDate(invoice.dispatchDate)}</td>
                            <td style={{ textAlign: "right" }}>{invoice.currency || ""} {money(invoice.amount)}</td>
                            <td style={{ textAlign: "right" }}>{money(invoice.received)}</td>
                            <td style={{ textAlign: "right" }}>{money(invoice.pending)}</td>
                            <td>{invoice.settled ? "Paid" : invoice.received > 0 ? "Part paid" : "Pending"}</td>
                          </tr>
                          {invoice.payments.map((payment) => (
                            <tr key={`p-${payment.id}`} style={{ color: "#64748b", fontSize: 12 }}>
                              <td colSpan={2} style={{ paddingLeft: 24 }}>
                                {formatDate(payment.receivedAt)} · {payment.paymentType === "FULL" ? "Full" : "Partial"}
                                {payment.remarks ? ` · ${payment.remarks}` : ""}
                              </td>
                              <td />
                              <td style={{ textAlign: "right" }}>{money(payment.amount)}</td>
                              <td colSpan={2}>
                                <button type="button" className="order-btn-secondary" onClick={() => removePayment(payment.id)} disabled={saving}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                {invoices.every((invoice) => invoice.settled) ? (
                  <p style={{ color: "#15803d", fontWeight: 600 }}>All invoices on this order are paid.</p>
                ) : (
                  <form onSubmit={submitPayment}>
                    <div className="masterdata-form-grid">
                      <div>
                        <label className="label">Against Invoice <span className="req">*</span></label>
                        <SearchableSelect
                          options={invoices.filter((invoice) => !invoice.settled).map((invoice) => ({
                            value: String(invoice.id),
                            label: `${invoiceLabel(invoice)} — pending ${money(invoice.pending)}`
                          }))}
                          value={String(form.dispatch_id)}
                          onChange={(value) => selectInvoice(invoices, value, form.payment_type)}
                          placeholder="Select invoice"
                        />
                      </div>
                      <div>
                        <label className="label">Payment <span className="req">*</span></label>
                        <SearchableSelect
                          options={PAYMENT_TYPE_OPTIONS}
                          value={form.payment_type}
                          onChange={(value) => {
                            setForm((prev) => ({
                              ...prev,
                              payment_type: value,
                              amount: value === "FULL" && selectedInvoice && selectedInvoice.pending !== null
                                ? String(selectedInvoice.pending)
                                : prev.amount
                            }));
                          }}
                          placeholder="Select type"
                        />
                      </div>
                      <div>
                        <label className="label">Amount Received <span className="req">*</span></label>
                        <input
                          autoComplete="off"
                          className="input"
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.amount}
                          onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <label className="label">Received On <span className="req">*</span></label>
                        <input
                          className="input"
                          type="date"
                          max={today()}
                          value={form.received_date}
                          onChange={(e) => setForm((p) => ({ ...p, received_date: e.target.value }))}
                          required
                        />
                      </div>
                      {selectedInvoice && !selectedInvoice.invoiceNumber && (
                        <div className="full-row">
                          <label className="label">Invoice Number</label>
                          <input
                            autoComplete="off"
                            className="input"
                            maxLength={100}
                            placeholder="Not entered at dispatch — add it here"
                            value={form.invoice_number}
                            onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
                          />
                        </div>
                      )}
                      <div className="full-row">
                        <label className="label">Remarks</label>
                        <textarea
                          className="input"
                          rows={2}
                          maxLength={190}
                          value={form.remarks}
                          onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
                          style={{ resize: "vertical" }}
                        />
                      </div>
                    </div>

                    <div className="masterdata-form-actions" style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid #e5e7eb" }}>
                      <button type="button" className="masterdata-btn-secondary" onClick={closePaymentModal} disabled={saving}>
                        Close
                      </button>
                      <button type="submit" className="masterdata-btn-primary" disabled={saving || !selectedInvoice}>
                        {saving ? "Saving..." : "Save Payment"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
            {invoices.length > 0 && invoices.every((invoice) => invoice.settled) && (
              <div className="masterdata-form-actions" style={{ marginTop: 16 }}>
                <button type="button" className="masterdata-btn-secondary" onClick={closePaymentModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default PaymentsPage;
