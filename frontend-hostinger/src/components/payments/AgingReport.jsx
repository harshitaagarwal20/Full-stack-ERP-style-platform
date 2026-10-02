import { useEffect, useMemo, useState } from "react";
import api from "../../api/axiosClient";
import { logApiError } from "../../utils/apiError";
import { exportRowsToExcel } from "../../utils/exportExcel";
import { SearchIcon } from "../erp/ErpIcons";

// Payment tracking went live in October 2026; invoices before that are legacy
// and stay out of the report. The backend applies the same cut-off by default.
const AGING_START_DATE = "2026-10-01";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

const money = (value) =>
  value === null || value === undefined ? "-" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

const BUCKET_TONE = { d0_30: "ok", d31_60: "warn", d61_90: "high", d90_plus: "danger" };

// Invoice-wise received vs pending, aged from the invoice (dispatch) date.
function AgingReport() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [fromDate, setFromDate] = useState(AGING_START_DATE);
  const [asOn, setAsOn] = useState("");
  const [includeSettled, setIncludeSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/payments/aging", {
          params: {
            from: fromDate,
            ...(searchText.trim() ? { q: searchText.trim() } : {}),
            ...(asOn ? { as_on: asOn } : {}),
            ...(includeSettled ? { include_settled: 1 } : {})
          }
        });
        if (!cancelled) setReport(data);
      } catch (error) {
        if (!cancelled) logApiError(error, "Failed to load the aging report");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchText, fromDate, asOn, includeSettled]);

  const buckets = report?.buckets || [];
  const rows = report?.rows || [];
  const bucketLabel = (key) => buckets.find((b) => b.key === key)?.label || "-";
  const currencyLabel = (currency) => (!currency || currency === "-" ? "No currency set" : currency);

  const periodLabel = useMemo(() => {
    if (!report) return "";
    return report.from ? `${formatDate(report.from)} - ${formatDate(report.asOn)}` : `up to ${formatDate(report.asOn)}`;
  }, [report]);

  const exportReport = () => {
    const columns = [
      { key: "invoiceNumber", header: "Invoice No" },
      { key: "invoiceDate", header: "Invoice Date" },
      { key: "orderNo", header: "Order No" },
      { key: "client", header: "Client" },
      { key: "product", header: "Product" },
      { key: "currency", header: "Currency" },
      { key: "invoiceAmount", header: "Invoice Amount" },
      { key: "received", header: "Received" },
      { key: "pending", header: "Pending" },
      { key: "age", header: "Age (days)" },
      { key: "bucket", header: "Aging Bucket" }
    ];
    exportRowsToExcel("payment-aging", columns, rows.map((row) => ({
      invoiceNumber: row.invoiceNumber || "-",
      invoiceDate: formatDate(row.invoiceDate),
      orderNo: row.orderNo || "-",
      client: row.clientName || "-",
      product: row.product || "-",
      currency: row.currency || "-",
      invoiceAmount: row.invoiceAmount ?? "-",
      received: row.received,
      pending: row.pending ?? "-",
      age: row.settled ? "-" : row.ageDays,
      bucket: row.settled ? "Settled" : bucketLabel(row.bucket)
    })));
  };

  return (
    <>
      <section className="order-card aging-filter-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input
            autoComplete="off"
            placeholder="Search invoice, order or client..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="aging-toolbar">
          <label className="aging-field">
            <span>Invoices from</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </label>
          <label className="aging-field">
            <span>Outstanding as on</span>
            <input type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
          </label>
          <label className="aging-check">
            <input type="checkbox" checked={includeSettled} onChange={(e) => setIncludeSettled(e.target.checked)} />
            <span>Show settled invoices</span>
          </label>
          <div className="aging-toolbar-end">
            {fromDate !== AGING_START_DATE && (
              <button className="aging-link-btn" type="button" onClick={() => setFromDate(AGING_START_DATE)}>
                Reset to Oct 2026
              </button>
            )}
            <button className="order-btn-secondary" onClick={exportReport} disabled={rows.length === 0}>Export to Excel</button>
          </div>
        </div>
      </section>

      <div className="aging-summary-grid">
        {(report?.summary || []).map((total) => (
          <section className="order-card aging-summary-card" key={total.currency}>
            <div className="aging-summary-head">
              <span className="aging-currency-pill">{currencyLabel(total.currency)}</span>
              <span className="aging-summary-period">Outstanding {periodLabel}</span>
            </div>
            <div className="aging-stat-row">
              <div className="aging-stat">
                <div className="aging-stat-label">Invoiced</div>
                <div className="aging-stat-value">{money(total.invoiced)}</div>
              </div>
              <div className="aging-stat">
                <div className="aging-stat-label">Received</div>
                <div className="aging-stat-value aging-stat-received">{money(total.received)}</div>
              </div>
              <div className="aging-stat">
                <div className="aging-stat-label">Pending</div>
                <div className="aging-stat-value aging-stat-pending">{money(total.pending)}</div>
              </div>
            </div>
            <div className="aging-bucket-row">
              {buckets.map((bucket) => {
                const value = total.buckets[bucket.key] || 0;
                return (
                  <div
                    key={bucket.key}
                    className={`aging-bucket aging-bucket-${BUCKET_TONE[bucket.key] || "ok"}${value ? "" : " is-empty"}`}
                  >
                    <div className="aging-bucket-label">{bucket.label}</div>
                    <div className="aging-bucket-value">{money(value)}</div>
                  </div>
                );
              })}
            </div>
            {total.unpriced > 0 && (
              <p className="aging-note">
                {total.unpriced} unsettled invoice{total.unpriced !== 1 ? "s" : ""} on unpriced orders are not in these totals.
              </p>
            )}
          </section>
        ))}
      </div>

      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => <div key={i} className="order-skeleton-row" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="order-empty-state">
            <p>No outstanding invoices{report?.from ? ` dated on or after ${formatDate(report.from)}` : ""}</p>
          </div>
        ) : (
          <div className="order-table-wrap aging-table-wrap">
            <div className="order-table-meta">
              {rows.length} invoice{rows.length !== 1 ? "s" : ""} · {periodLabel}
            </div>
            <table className="order-table aging-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Invoice Date</th>
                  <th>Order No</th>
                  <th>Client</th>
                  <th style={{ textAlign: "right" }}>Invoice Amount</th>
                  <th style={{ textAlign: "right" }}>Received</th>
                  <th style={{ textAlign: "right" }}>Pending</th>
                  <th style={{ textAlign: "right" }}>Age (days)</th>
                  <th>Bucket</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.dispatchId}>
                    <td style={{ fontWeight: 600 }}>{row.invoiceNumber || <span className="pack-cell-sub">Not entered</span>}</td>
                    <td>{formatDate(row.invoiceDate)}</td>
                    <td>{row.orderNo || "-"}</td>
                    <td>{row.clientName || "-"}</td>
                    <td className="aging-num">{row.currency || ""} {money(row.invoiceAmount)}</td>
                    <td className="aging-num">{money(row.received)}</td>
                    <td className="aging-num aging-num-strong">{money(row.pending)}</td>
                    <td className="aging-num">{row.settled ? "-" : row.ageDays}</td>
                    <td>
                      {row.settled ? (
                        <span className="aging-pill aging-pill-settled">Settled</span>
                      ) : (
                        <span className={`aging-pill aging-pill-${BUCKET_TONE[row.bucket] || "ok"}`}>{bucketLabel(row.bucket)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default AgingReport;
