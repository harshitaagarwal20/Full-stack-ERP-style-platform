import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateTime(val) {
  return val ? new Date(val).toLocaleString() : "-";
}

const STATUS_STYLE = {
  DRAFT:     { background: "#fefce8", color: "#854d0e", border: "1px solid #fde68a" },
  CONFIRMED: { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.DRAFT;
  return (
    <span style={{ ...s, padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600, display: "inline-block" }}>
      {status === "CONFIRMED" ? "Confirmed" : "Draft"}
    </span>
  );
}

function GrnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [grn, setGrn]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [confirming, setConfirming] = useState(false);

  const loadGRN = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/grns/${id}`);
      setGrn(data);
    } catch (error) {
      logApiError(error, "Failed to load GRN");
      navigate("/grns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGRN(); }, [id]);

  const handleConfirm = async () => {
    if (!window.confirm("Confirm this GRN? This will update inventory and PO received quantities. This cannot be undone.")) return;
    setConfirming(true);
    try {
      await api.post(`/grns/${id}/confirm`);
      dispatchUserMessage("GRN confirmed and inventory updated.", { title: "Confirmed", variant: "success" });
      await loadGRN();
    } catch (error) {
      logApiError(error, "Failed to confirm GRN");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <div className="order-skeleton-list">
          <div className="order-skeleton-row" />
          <div className="order-skeleton-row" />
        </div>
      </div>
    );
  }

  if (!grn) return null;

  const totalOrdered  = (grn.items || []).reduce((s, i) => s + (i.quantityOrdered  || 0), 0);
  const totalReceived = (grn.items || []).reduce((s, i) => s + (i.quantityReceived || 0), 0);
  const isConfirmed   = grn.status === "CONFIRMED";

  return (
    <div className="order-page">
      {/* Header */}
      <section className="order-card po-detail-header">
        <div className="po-detail-header-top">
          <button className="order-btn-secondary" onClick={() => navigate("/grns")}>
            ← Goods Receipts
          </button>
          <div className="po-detail-header-meta">
            <div className="po-detail-title-block">
              <div className="po-detail-number">{grn.grnNumber}</div>
              <div className="po-detail-supplier-name">
                <span
                  style={{ color: "#2563eb", cursor: "pointer", fontWeight: 600 }}
                  onClick={() => navigate(`/purchase-orders/${grn.purchaseOrder?.id}`)}
                >
                  {grn.purchaseOrder?.poNumber}
                </span>
                {" — "}{grn.purchaseOrder?.supplier?.name}
              </div>
            </div>
            <StatusBadge status={grn.status} />
          </div>
        </div>
        {!isConfirmed && (
          <div className="po-detail-actions">
            <button className="order-btn-primary" disabled={confirming} onClick={handleConfirm}>
              {confirming ? "Confirming..." : "Confirm GRN"}
            </button>
          </div>
        )}
      </section>

      {/* Info side by side */}
      <div className="po-detail-info-grid">
        <section className="order-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Receipt Details
          </h3>
          <div className="order-detail-grid">
            <p><span>GRN Number</span> {grn.grnNumber}</p>
            <p><span>Status</span> <StatusBadge status={grn.status} /></p>
            <p><span>Received Date</span> {formatDate(grn.receivedDate)}</p>
            <p><span>Received By</span> {grn.receivedBy || "-"}</p>
            <p><span>Vehicle / Ref</span> {grn.vehicleRef || "-"}</p>
            <p><span>Warehouse</span> {grn.warehouseLocation || "-"}</p>
            <p><span>Created At</span> {formatDateTime(grn.createdAt)}</p>
            <p><span>Last Updated</span> {formatDateTime(grn.updatedAt)}</p>
            {grn.remarks && (
              <p style={{ gridColumn: "1 / -1" }}><span>Remarks</span> {grn.remarks}</p>
            )}
          </div>
        </section>

        <section className="order-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Purchase Order
          </h3>
          <div className="order-detail-grid">
            <p style={{ gridColumn: "1 / -1" }}>
              <span>PO Number</span>
              <strong
                style={{ color: "#2563eb", cursor: "pointer" }}
                onClick={() => navigate(`/purchase-orders/${grn.purchaseOrder?.id}`)}
              >
                {grn.purchaseOrder?.poNumber}
              </strong>
            </p>
            <p><span>PO Status</span> {grn.purchaseOrder?.status || "-"}</p>
            <p style={{ gridColumn: "1 / -1" }}><span>Supplier</span> <strong>{grn.purchaseOrder?.supplier?.name || "-"}</strong></p>
          </div>

          {/* Totals summary */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Items", value: grn.items?.length || 0 },
              { label: "Total Ordered", value: totalOrdered },
              { label: "Total Received", value: totalReceived, highlight: true },
              { label: "Variance", value: totalReceived - totalOrdered, color: totalReceived >= totalOrdered ? "#16a34a" : "#dc2626" }
            ].map(({ label, value, highlight, color }) => (
              <div key={label} style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                padding: "10px 14px"
              }}>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: color || (highlight ? "#0f172a" : "#334155"), marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Line Items */}
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Line Items ({grn.items?.length || 0})
        </h3>
        <div className="responsive-table-wrap">
          <table className="order-table responsive-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Category</th>
                <th>Grade</th>
                <th>UOM</th>
                <th>Batch No</th>
                <th>Qty Ordered</th>
                <th>Qty Received</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {(grn.items || []).map((item, index) => {
                const over = item.quantityReceived > item.quantityOrdered;
                const done = item.quantityReceived >= item.quantityOrdered;
                return (
                  <tr key={item.id}>
                    <td data-label="" style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                    <td data-label="Item" style={{ fontWeight: 600 }}>{item.itemId || "-"}</td>
                    <td data-label="Category">{item.category || "-"}</td>
                    <td data-label="Grade">{item.grade || "-"}</td>
                    <td data-label="UOM">{item.uom || "-"}</td>
                    <td data-label="Batch No">{item.batchNo || "-"}</td>
                    <td data-label="Qty Ordered">{item.quantityOrdered}</td>
                    <td data-label="Qty Received">
                      <span style={{
                        fontWeight: 700,
                        color: over ? "#d97706" : done ? "#16a34a" : "#0f172a"
                      }}>
                        {item.quantityReceived}
                        {over && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>(+{item.quantityReceived - item.quantityOrdered})</span>}
                      </span>
                    </td>
                    <td data-label="Remarks" style={{ color: "#64748b" }}>{item.remarks || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, paddingRight: 12 }}>Total</td>
                <td style={{ fontWeight: 700 }}>{totalOrdered}</td>
                <td style={{ fontWeight: 700, color: totalReceived >= totalOrdered ? "#16a34a" : "#0f172a" }}>{totalReceived}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {!isConfirmed && (
        <section className="order-card grn-confirm-footer">
          <button
            className="order-btn-secondary"
            onClick={() => navigate(`/purchase-orders/${grn.purchaseOrder?.id}`)}
          >
            Back to PO
          </button>
          <button className="order-btn-primary" disabled={confirming} onClick={handleConfirm}>
            {confirming ? "Confirming..." : "Confirm GRN"}
          </button>
        </section>
      )}
    </div>
  );
}

export default GrnDetailPage;
