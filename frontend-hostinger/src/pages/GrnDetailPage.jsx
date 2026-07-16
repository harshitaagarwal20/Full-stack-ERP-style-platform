import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import SearchableSelect from "../components/common/SearchableSelect";
import StatusBadge from "../components/common/StatusBadge";
import { GRN_STATUS_CONFIG } from "../config/statusConfig";
import { useIsMobile } from "../hooks/useIsMobile";
import { minEntryDateFor } from "../utils/dateRules";
import SampleFormModal from "../components/production/SampleFormModal";
import SampleList from "../components/production/SampleList";

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

// A raw material test sheet always tests what actually arrived, so a fresh sheet
// starts as one row per received line — product, batch and supplier already
// filled in from the PO rather than retyped by hand.
function qcRowsFromGrn(grn) {
  const supplier = grn?.purchaseOrder?.supplier?.name || "";
  const received = (grn?.items || []).filter((item) => Number(item.quantityReceived) > 0);
  const source = received.length ? received : (grn?.items || []);

  if (!source.length) return [emptyQcRow()];

  return source.map((item) => ({
    ...emptyQcRow(),
    product_name: item.itemId || "",
    batch_no:     item.batchNo || "",
    supplier,
    sample_qty:   ""
  }));
}

function GrnDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [grn, setGrn]               = useState(null);
  const [loading, setLoading]       = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [savingQc, setSavingQc]     = useState(false);
  const [qcRows, setQcRows]         = useState([emptyQcRow()]);
  const [qcOverallResult, setQcOverallResult] = useState("PENDING");
  const [qcApprovedBy, setQcApprovedBy]       = useState("");

  // Which sample the form is open on: an index to edit, or "new".
  const [editingQc, setEditingQc] = useState(null);
  const [qcDraft, setQcDraft]     = useState(null);

  const loadGRN = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/grns/${id}`);
      setGrn(data);
      // No sheet saved yet → seed it from the consignment.
      if (!data.qcTestSheet?.items?.length) {
        setQcRows(qcRowsFromGrn(data));
      }
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

  // Only what this consignment actually contains can be tested on its sheet.
  const grnProductOptions = (grn?.items || [])
    .map((item) => item.itemId)
    .filter(Boolean)
    .map((itemId) => ({ value: itemId, label: itemId }));

  // A sample is drawn from the consignment line, so it can never exceed what was
  // ordered on that line.
  const orderedQtyByItemId = new Map(
    (grn?.items || []).map((item) => [item.itemId, Number(item.quantityOrdered || 0)])
  );
  const orderedQtyFor = (productName) => orderedQtyByItemId.get(productName);

  // The sheet's twelve columns, grouped into what a person actually does: say
  // which line was sampled, note the supplier's facts about the material, record
  // the test, sign it off.
  const QC_SECTIONS = [
    {
      title: "Sample",
      fields: [
        { key: "sampling_date", label: "Date of Sampling", type: "date", min: minEntryDateFor },
        {
          key: "product_name",
          label: "Product Name",
          type: "searchable",
          options: grnProductOptions,
          placeholder: "Select product",
          allowCustom: true,
          // Picking the product pulls its batch across with it — same line, same
          // consignment, so retyping the batch number is only a chance to get it wrong.
          derive: (value, draft) => {
            const line = (grn?.items || []).find((item) => item.itemId === value);
            return {
              batch_no: line?.batchNo || draft.batch_no,
              supplier: draft.supplier || grn?.purchaseOrder?.supplier?.name || ""
            };
          }
        },
        { key: "batch_no", label: "Batch No." },
        { key: "supplier", label: "Mfr./Supplier" }
      ]
    },
    {
      // The supplier's facts about the material, not a record of when we did
      // something — so these are free to sit in the past.
      title: "Material",
      fields: [
        { key: "mfg_date",    label: "Mfg. Date",   type: "date" },
        { key: "expiry_date", label: "Expiry Date", type: "date" }
      ]
    },
    {
      title: "Test",
      fields: [
        { key: "sample_qty",     label: "Qty. of Sample", type: "number", max: (draft) => orderedQtyFor(draft.product_name) },
        { key: "test_parameter", label: "Test Parameter" },
        { key: "result",         label: "Result" }
      ]
    },
    {
      title: "Sign-off",
      fields: [
        { key: "analysis_by", label: "Analysis By" },
        { key: "remarks",     label: "Remarks", wide: true }
      ]
    }
  ];

  const summarizeQcRow = (row) => {
    const primary = [row.product_name || "—", row.batch_no ? `Batch ${row.batch_no}` : null]
      .filter(Boolean).join(" · ");
    const detail = [
      row.sampling_date || null,
      row.test_parameter ? `${row.test_parameter}: ${row.result || "—"}` : null
    ].filter(Boolean);
    return { primary, secondary: detail.length ? detail.join(" · ") : "No result yet" };
  };

  const openNewQcRow = () => {
    setQcDraft({ ...emptyQcRow(), supplier: grn?.purchaseOrder?.supplier?.name || "" });
    setEditingQc("new");
  };

  const openEditQcRow = (index) => {
    setQcDraft(qcRows[index]);
    setEditingQc(index);
  };

  const closeQcForm = () => {
    setEditingQc(null);
    setQcDraft(null);
  };

  const commitQcRow = (sample) => {
    setQcRows((rows) => (
      editingQc === "new"
        ? [...rows, sample]
        : rows.map((row, i) => (i === editingQc ? sample : row))
    ));
    closeQcForm();
  };

  const removeQcRow = (index) => setQcRows((rows) => rows.filter((_, i) => i !== index));

  const handleSaveQc = async () => {
    const approvedBy = qcApprovedBy.trim();
    const makerNames = qcRows.map((row) => row.analysis_by.trim()).filter(Boolean);
    if (approvedBy && makerNames.some((name) => name.toLowerCase() === approvedBy.toLowerCase())) {
      window.alert("Approved By must be a different person from the maker (Analysis By) on this test sheet.");
      return;
    }

    const oversized = qcRows.find((row) => {
      if (row.sample_qty === "" || row.sample_qty == null) return false;
      const ordered = orderedQtyFor(row.product_name);
      return ordered !== undefined && Number(row.sample_qty) > ordered;
    });
    if (oversized) {
      window.alert(
        `Sample quantity for ${oversized.product_name} (${oversized.sample_qty}) cannot be more than the ordered quantity (${orderedQtyFor(oversized.product_name)}).`
      );
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

  const handleReject = async () => {
    const reason = window.prompt(
      "Reject this consignment? None of its material will enter inventory.\n\nReason:"
    );
    if (reason === null) return;
    if (!reason.trim()) {
      dispatchUserMessage("A rejection needs a reason.", { title: "Reject", variant: "error" });
      return;
    }

    setRejecting(true);
    try {
      await api.post(`/grns/${id}/reject`, { rejection_reason: reason.trim() });
      dispatchUserMessage("Consignment rejected. No stock was booked in.", { title: "Rejected", variant: "success" });
      await loadGRN();
    } catch (error) {
      logApiError(error, "Failed to reject the consignment");
    } finally {
      setRejecting(false);
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
  const isRejected    = grn.status === "REJECTED";
  const qcPassed      = grn.qcTestSheet?.overallResult === "PASS";
  const qcFailed      = grn.qcTestSheet?.overallResult === "FAIL";
  const canConfirm    = !isConfirmed && !isRejected && qcPassed;

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
        {!isConfirmed && !isRejected && (
          <div className="po-detail-actions">
            <button className="order-btn-primary" disabled={confirming || !canConfirm} title={!qcPassed ? "QC test sheet must be completed with a Pass result first" : undefined} onClick={handleConfirm}>
              {confirming ? "Confirming..." : "Confirm GRN"}
            </button>
            {/* The other outcome of the raw material test: turn the consignment
                away. Only offered once the sheet has actually failed. */}
            {qcFailed && (
              <button className="order-btn-secondary" disabled={rejecting} onClick={handleReject}>
                {rejecting ? "Rejecting..." : "Reject Consignment"}
              </button>
            )}
          </div>
        )}

        {isRejected && (
          <div className="grn-rejected-note">
            <strong>Consignment rejected.</strong> {grn.rejectionReason}
            <span> This GRN can never be confirmed, so none of its material entered inventory.</span>
          </div>
        )}
      </section>

      {/* QC Test Sheet */}
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Raw Material Test Sheet (QC)
        </h3>
        {/* A confirmed sheet is a record, not a form: show every column, stacked
            into a card per sample on a phone. */}
        {isConfirmed ? (
          <div className="responsive-table-wrap">
            <table className="order-table responsive-table">
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
                </tr>
              </thead>
              <tbody>
                {qcRows.map((row, index) => (
                  <tr key={index}>
                    <td data-label="" style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                    <td data-label="Date of Sampling">{row.sampling_date || "-"}</td>
                    <td data-label="Product Name" style={{ fontWeight: 600 }}>{row.product_name || "-"}</td>
                    <td data-label="Batch No.">{row.batch_no || "-"}</td>
                    <td data-label="Mfg. Date">{row.mfg_date || "-"}</td>
                    <td data-label="Expiry Date">{row.expiry_date || "-"}</td>
                    <td data-label="Mfr./Supplier">{row.supplier || "-"}</td>
                    <td data-label="Qty. of Sample">{row.sample_qty === "" ? "-" : row.sample_qty}</td>
                    <td data-label="Test Parameter">{row.test_parameter || "-"}</td>
                    <td data-label="Result">{row.result || "-"}</td>
                    <td data-label="Analysis By">{row.analysis_by || "-"}</td>
                    <td data-label="Remarks" style={{ color: "#64748b" }}>{row.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <SampleList
            rows={qcRows}
            summarize={summarizeQcRow}
            onAdd={openNewQcRow}
            onEdit={openEditQcRow}
            onRemove={removeQcRow}
          />
        )}

        {!isConfirmed && (
          <>
            <div className="mfg-verdict">
              <div className="mfg-verdict-field">
                <label className="label">Overall Result</label>
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
              <div className="mfg-verdict-field">
                <label className="label">Approved By</label>
                <input className="input" autoComplete="off" value={qcApprovedBy} onChange={(e) => setQcApprovedBy(e.target.value)} />
              </div>
            </div>

            <div className="sample-actions">
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

      {editingQc !== null && (
        <SampleFormModal
          title={editingQc === "new" ? "Add Sample" : `Edit Sample #${editingQc + 1}`}
          sections={QC_SECTIONS}
          value={qcDraft}
          onSave={commitQcRow}
          onCancel={closeQcForm}
        />
      )}

      {/* Info side by side — desktop only. On a phone this is a long scroll of
          reference detail between the operator and the test sheet they came to fill in. */}
      {!isMobile && (
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
              <span>PO Number</span>{" "}
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
      )}

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
          <button className="order-btn-primary" disabled={confirming || !canConfirm} title={!qcPassed ? "QC test sheet must be completed with a Pass result first" : undefined} onClick={handleConfirm}>
            {confirming ? "Confirming..." : "Confirm GRN"}
          </button>
        </section>
      )}
    </div>
  );
}

export default GrnDetailPage;
