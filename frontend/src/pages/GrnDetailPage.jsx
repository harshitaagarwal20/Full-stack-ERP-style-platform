import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import StatusBadge from "../components/common/StatusBadge";
import { GRN_STATUS_CONFIG } from "../config/statusConfig";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatDateTime(val) {
  return val ? new Date(val).toLocaleString() : "-";
}

function emptyQcRow() {
  return {
    sampling_date: "", product_name: "", batch_no: "", mfg_date: "", expiry_date: "",
    supplier: "", sample_qty: "", test_parameter: "", result: "", analysis_by: "", remarks: ""
  };
}

function GrnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [grn, setGrn]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [savingQc, setSavingQc]     = useState(false);
  const [qcRows, setQcRows]         = useState([emptyQcRow()]);
  const [qcOverallResult, setQcOverallResult] = useState("PENDING");
  const [qcApprovedBy, setQcApprovedBy]       = useState("");

  const loadGRN = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/grns/${id}`);
      setGrn(data);
      if (data.qcTestSheet) {
        setQcOverallResult(data.qcTestSheet.overallResult || "PENDING");
        setQcApprovedBy(data.qcTestSheet.approvedBy || "");
        if (data.qcTestSheet.items?.length) {
          setQcRows(data.qcTestSheet.items.map((item) => ({
            sampling_date:  item.samplingDate ? item.samplingDate.slice(0, 10) : "",
            product_name:   item.productName || "",
            batch_no:       item.batchNo || "",
            mfg_date:       item.mfgDate ? item.mfgDate.slice(0, 10) : "",
            expiry_date:    item.expiryDate ? item.expiryDate.slice(0, 10) : "",
            supplier:       item.supplier || "",
            sample_qty:     item.sampleQty ?? "",
            test_parameter: item.testParameter || "",
            result:         item.result || "",
            analysis_by:    item.analysisBy || "",
            remarks:        item.remarks || ""
          })));
        }
      }
    } catch (error) {
      logApiError(error, "Failed to load GRN");
      navigate("/grns");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGRN(); }, [id]);

  const setQcRowField = (index, field, value) => {
    setQcRows((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addQcRow = () => setQcRows((rows) => [...rows, emptyQcRow()]);
  const removeQcRow = (index) => setQcRows((rows) => rows.length > 1 ? rows.filter((_, i) => i !== index) : rows);

  const handleSaveQc = async () => {
    const approvedBy = qcApprovedBy.trim();
    const makerNames = qcRows.map((row) => row.analysis_by.trim()).filter(Boolean);
    if (approvedBy && makerNames.some((name) => name.toLowerCase() === approvedBy.toLowerCase())) {
      window.alert("Approved By must be a different person from the maker (Analysis By) on this test sheet.");
      return;
    }

    setSavingQc(true);
    try {
      await api.post(`/grns/${id}/qc`, {
        overall_result: qcOverallResult,
        approved_by: qcApprovedBy || null,
        items: qcRows
          .filter((row) => row.product_name.trim())
          .map((row) => ({
            ...row,
            sample_qty: row.sample_qty === "" ? null : Number(row.sample_qty)
          }))
      });
      dispatchUserMessage("QC test sheet saved.", { title: "Saved", variant: "success" });
      await loadGRN();
    } catch (error) {
      logApiError(error, "Failed to save QC test sheet");
    } finally {
      setSavingQc(false);
    }
  };

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
  const qcPassed      = grn.qcTestSheet?.overallResult === "PASS";
  const canConfirm    = !isConfirmed && qcPassed;

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
            <StatusBadge status={grn.status} config={GRN_STATUS_CONFIG} />
          </div>
        </div>
        {!isConfirmed && (
          <div className="po-detail-actions">
            <button className="order-btn-primary" disabled={confirming || !canConfirm} title={!qcPassed ? "QC test sheet must be completed with a Pass result first" : undefined} onClick={handleConfirm}>
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
            <p><span>Status</span> <StatusBadge status={grn.status} config={GRN_STATUS_CONFIG} /></p>
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
        <div className="order-table-wrap">
          <table className="order-table">
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
                    <td style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                    <td style={{ fontWeight: 600 }}>{item.itemId || "-"}</td>
                    <td>{item.category || "-"}</td>
                    <td>{item.grade || "-"}</td>
                    <td>{item.uom || "-"}</td>
                    <td>{item.batchNo || "-"}</td>
                    <td>{item.quantityOrdered}</td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: over ? "#d97706" : done ? "#16a34a" : "#0f172a"
                      }}>
                        {item.quantityReceived}
                        {over && <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>(+{item.quantityReceived - item.quantityOrdered})</span>}
                      </span>
                    </td>
                    <td style={{ color: "#64748b" }}>{item.remarks || "-"}</td>
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

      {/* QC Test Sheet */}
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Raw Material Test Sheet (QC)
        </h3>
        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date of Sampling</th>
                <th>Product Name</th>
                <th>Batch No.</th>
                <th>Mfg. Date</th>
                <th>Expiry Date</th>
                <th>Mfr./Supplier</th>
                <th>Qty. of Sample</th>
                <th>Test Parameter</th>
                <th>Result</th>
                <th>Analysis By</th>
                <th>Remarks</th>
                {!isConfirmed && <th />}
              </tr>
            </thead>
            <tbody>
              {qcRows.map((row, index) => (
                <tr key={index}>
                  <td style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                  {isConfirmed ? (
                    <>
                      <td>{row.sampling_date || "-"}</td>
                      <td style={{ fontWeight: 600 }}>{row.product_name || "-"}</td>
                      <td>{row.batch_no || "-"}</td>
                      <td>{row.mfg_date || "-"}</td>
                      <td>{row.expiry_date || "-"}</td>
                      <td>{row.supplier || "-"}</td>
                      <td>{row.sample_qty === "" ? "-" : row.sample_qty}</td>
                      <td>{row.test_parameter || "-"}</td>
                      <td>{row.result || "-"}</td>
                      <td>{row.analysis_by || "-"}</td>
                      <td style={{ color: "#64748b" }}>{row.remarks || "-"}</td>
                    </>
                  ) : (
                    <>
                      <td><input className="mfg-cell-input" type="date" value={row.sampling_date} onChange={(e) => setQcRowField(index, "sampling_date", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.product_name} onChange={(e) => setQcRowField(index, "product_name", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.batch_no} onChange={(e) => setQcRowField(index, "batch_no", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" type="date" value={row.mfg_date} onChange={(e) => setQcRowField(index, "mfg_date", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" type="date" value={row.expiry_date} onChange={(e) => setQcRowField(index, "expiry_date", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.supplier} onChange={(e) => setQcRowField(index, "supplier", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" type="number" value={row.sample_qty} onChange={(e) => setQcRowField(index, "sample_qty", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.test_parameter} onChange={(e) => setQcRowField(index, "test_parameter", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.result} onChange={(e) => setQcRowField(index, "result", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.analysis_by} onChange={(e) => setQcRowField(index, "analysis_by", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.remarks} onChange={(e) => setQcRowField(index, "remarks", e.target.value)} /></td>
                      <td>
                        <button className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeQcRow(index)}>×</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isConfirmed && (
          <>
            <button className="order-btn-secondary" style={{ marginTop: 10 }} onClick={addQcRow}>+ Add Row</button>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Overall Result</div>
                <SearchableSelect
                  options={[
                    { value: "PENDING", label: "Pending" },
                    { value: "PASS", label: "Pass" },
                    { value: "FAIL", label: "Fail" }
                  ]}
                  value={qcOverallResult}
                  onChange={(value) => setQcOverallResult(value)}
                  placeholder="Select result"
                />
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Approved By</div>
                <input className="mfg-cell-input" value={qcApprovedBy} onChange={(e) => setQcApprovedBy(e.target.value)} />
              </div>
              <button className="order-btn-primary" disabled={savingQc} onClick={handleSaveQc}>
                {savingQc ? "Saving..." : "Save QC Test Sheet"}
              </button>
            </div>
          </>
        )}

        {!isConfirmed && !qcPassed && (
          <p style={{ marginTop: 12, color: "#d97706", fontSize: 13 }}>
            GRN cannot be confirmed until the QC test sheet is saved with an overall result of "Pass".
          </p>
        )}
      </section>

      {!isConfirmed && (
        <section className="order-card grn-confirm-footer">
          <button
            className="order-btn-secondary"
            onClick={() => navigate(`/purchase-orders/${grn.purchaseOrder?.id}`)}
          >
            Back to PO
          </button>
          <button className="order-btn-primary" disabled={confirming || !canConfirm} title={!qcPassed ? "QC test sheet must be completed with a Pass result first" : undefined} onClick={handleConfirm}>
            {confirming ? "Confirming..." : "Confirm GRN"}
          </button>
        </section>
      )}
    </div>
  );
}

export default GrnDetailPage;
