import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";

function emptyInProcessRow() {
  return {
    analysis_date: "", shift: "", lot_no: "", reactor_no: "", sampling_by: "", sampling_time: "",
    free_fatty_acid: "", ash: "", moisture: "", appearance: "", melting_point: "",
    analysis_by: "", ffa_inform_time: "", remarks: ""
  };
}

function ProductionInProcessTestPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);

  const [rows, setRows] = useState([emptyInProcessRow()]);
  const [productName, setProductName] = useState("");
  const [grade, setGrade] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    const sheet = record.inProcessTestSheet;
    if (sheet) {
      setProductName(sheet.productName || "");
      setGrade(sheet.grade || "");
      setBatchNo(sheet.batchNo || "");
      if (sheet.items?.length) {
        setRows(sheet.items.map((item) => ({
          analysis_date:   item.analysisDate ? item.analysisDate.slice(0, 10) : "",
          shift:           item.shift || "",
          lot_no:          item.lotNo || "",
          reactor_no:      item.reactorNo || "",
          sampling_by:     item.samplingBy || "",
          sampling_time:   item.samplingTime || "",
          free_fatty_acid: item.freeFattyAcid || "",
          ash:             item.ash || "",
          moisture:        item.moisture || "",
          appearance:      item.appearance || "",
          melting_point:   item.meltingPoint || "",
          analysis_by:     item.analysisBy || "",
          ffa_inform_time: item.ffaInformTime || "",
          remarks:         item.remarks || ""
        })));
      }
    } else {
      setProductName(record.productSpecs || "");
      setBatchNo(record.batchNo || "");
    }
  }, [record]);

  const setRowField = (index, field, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyInProcessRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const onSave = async () => {
    if (!record || saving) return;
    setSaving(true);
    try {
      await api.post(`/production/${record.id}/in-process-test`, {
        product_name: productName || null,
        grade: grade || null,
        batch_no: batchNo || null,
        items: rows.filter((row) =>
          row.shift.trim() || row.lot_no.trim() || row.reactor_no.trim() || row.sampling_by.trim() ||
          row.free_fatty_acid.trim() || row.ash.trim() || row.moisture.trim() || row.appearance.trim()
        )
      });
      dispatchUserMessage("In-process test sheet saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save in-process test sheet");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <div className="order-skeleton-list">
          <div className="order-skeleton-row" />
        </div>
      </div>
    );
  }

  if (!record) return null;

  return (
    <div className="order-page">
      <ProductionStepNav record={record} activeStep="in-process-testing" />

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          In-Process Product Test Sheet
        </h3>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Product Name</div>
            <input className="mfg-cell-input" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={!canManageProduction} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Grade</div>
            <input className="mfg-cell-input" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={!canManageProduction} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Batch No.</div>
            <input className="mfg-cell-input" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} disabled={!canManageProduction} />
          </div>
        </div>

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Date of Analysis</th>
                <th>Shift</th>
                <th>Lot No.</th>
                <th>Reactor No.</th>
                <th>Sampling By</th>
                <th>Sampling Time</th>
                <th>Free Fatty Acid %</th>
                <th>Ash</th>
                <th>Moisture</th>
                <th>Appearance</th>
                <th>Melting Point</th>
                <th>Analysis By</th>
                <th>FFA Inform Time</th>
                <th>Remark</th>
                {canManageProduction && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                  {canManageProduction ? (
                    <>
                      <td><input className="mfg-cell-input" type="date" value={row.analysis_date} onChange={(e) => setRowField(index, "analysis_date", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.shift} onChange={(e) => setRowField(index, "shift", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.lot_no} onChange={(e) => setRowField(index, "lot_no", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.reactor_no} onChange={(e) => setRowField(index, "reactor_no", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.sampling_by} onChange={(e) => setRowField(index, "sampling_by", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.sampling_time} onChange={(e) => setRowField(index, "sampling_time", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.free_fatty_acid} onChange={(e) => setRowField(index, "free_fatty_acid", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.ash} onChange={(e) => setRowField(index, "ash", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.moisture} onChange={(e) => setRowField(index, "moisture", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.appearance} onChange={(e) => setRowField(index, "appearance", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.melting_point} onChange={(e) => setRowField(index, "melting_point", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.analysis_by} onChange={(e) => setRowField(index, "analysis_by", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.ffa_inform_time} onChange={(e) => setRowField(index, "ffa_inform_time", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.remarks} onChange={(e) => setRowField(index, "remarks", e.target.value)} /></td>
                      <td>
                        <button className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.analysis_date || "-"}</td>
                      <td>{row.shift || "-"}</td>
                      <td>{row.lot_no || "-"}</td>
                      <td>{row.reactor_no || "-"}</td>
                      <td>{row.sampling_by || "-"}</td>
                      <td>{row.sampling_time || "-"}</td>
                      <td>{row.free_fatty_acid || "-"}</td>
                      <td>{row.ash || "-"}</td>
                      <td>{row.moisture || "-"}</td>
                      <td>{row.appearance || "-"}</td>
                      <td>{row.melting_point || "-"}</td>
                      <td>{row.analysis_by || "-"}</td>
                      <td>{row.ffa_inform_time || "-"}</td>
                      <td>{row.remarks || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManageProduction && (
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
            <button className="order-btn-secondary" onClick={addRow}>+ Add Row</button>
            <button className="order-btn-primary" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save In-Process Test Sheet"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default ProductionInProcessTestPage;
