import { useEffect, useState } from "react";
import api from "../../api/axiosClient";
import { logApiError } from "../../utils/apiError";
import { exportRowsToExcel } from "../../utils/exportExcel";
import { SearchIcon } from "../erp/ErpIcons";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

const money = (value) =>
  value === null || value === undefined ? "-" : Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });

// Invoice-wise received vs pending, aged from the invoice (dispatch) date.
function AgingReport() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [asOn, setAsOn] = useState("");
  const [includeSettled, setIncludeSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/payments/aging", {
          params: {
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
  }, [searchText, asOn, includeSettled]);

  const buckets = report?.buckets || [];
  const rows = report?.rows || [];
  const bucketLabel = (key) => buckets.find((b) => b.key === key)?.label || "-";

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
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input
            autoComplete="off"
            placeholder="Search invoice, order or client..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div className="unified-filter-row" style={{ alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            As on
            <input className="input" type="date" value={asOn} onChange={(e) => setAsOn(e.target.value)} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="checkbox" checked={includeSettled} onChange={(e) => setIncludeSettled(e.target.checked)} />
            Show settled invoices
          </label>
        </div>
        <div className="unified-actions">
          <button className="order-btn-secondary" onClick={exportReport} disabled={rows.length === 0}>Export to Excel</button>
        </div>
      </section>

      {(report?.summary || []).map((total) => (
        <section className="order-card" key={total.currency}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            Outstanding as on {formatDate(report.asOn)} · {total.currency}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            <div><div className="pack-cell-sub">Invoiced</div><strong>{money(total.invoiced)}</strong></div>
            <div><div className="pack-cell-sub">Received</div><strong>{money(total.received)}</strong></div>
            <div><div className="pack-cell-sub">Pending</div><strong>{money(total.pending)}</strong></div>
            {buckets.map((bucket) => (
              <div key={bucket.key}>
                <div className="pack-cell-sub">{bucket.label}</div>
                <strong>{money(total.buckets[bucket.key])}</strong>
              </div>
            ))}
          </div>
          {total.unpriced > 0 && (
            <small style={{ color: "#b45309" }}>
              {total.unpriced} unsettled invoice{total.unpriced !== 1 ? "s" : ""} on unpriced orders are not in these totals.
            </small>
          )}
        </section>
      ))}

      <section className="order-card" style={{ padding: 0, overflow: "hidden" }}>
        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((i) => <div key={i} className="order-skeleton-row" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="order-empty-state"><p>No outstanding invoices</p></div>
        ) : (
          <div className="order-table-wrap">
            <div className="order-table-meta">{rows.length} invoice{rows.length !== 1 ? "s" : ""}</div>
            <table className="order-table">
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
                    <td style={{ textAlign: "right" }}>{row.currency || ""} {money(row.invoiceAmount)}</td>
                    <td style={{ textAlign: "right" }}>{money(row.received)}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{money(row.pending)}</td>
                    <td style={{ textAlign: "right" }}>{row.settled ? "-" : row.ageDays}</td>
                    <td>{row.settled ? "Settled" : bucketLabel(row.bucket)}</td>
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
