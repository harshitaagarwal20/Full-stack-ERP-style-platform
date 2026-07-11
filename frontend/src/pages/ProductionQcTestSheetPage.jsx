import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import SearchableSelect from "../components/common/SearchableSelect";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";

function emptyQcRow() {
  return {
    sample_date: "", shift: "", sampling_by: "", sampling_time: "",
    black_particle: "", bulk_density: "", sieve_residue: "", analysis_by: "", remarks: ""
  };
}

function ProductionQcTestSheetPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);

  const [rows, setRows] = useState([emptyQcRow()]);
  const [overallResult, setOverallResult] = useState("PENDING");
  const [approvedBy, setApprovedBy] = useState("");
  const [productName, setProductName] = useState("");
  const [grade, setGrade] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    const sheet = record.finishedGoodsTestSheet;
    if (sheet) {
      setOverallResult(sheet.overallResult || "PENDING");
      setApprovedBy(sheet.approvedBy || "");
      setProductName(sheet.productName || "");
      setGrade(sheet.grade || "");
      setBatchNo(sheet.batchNo || "");
      if (sheet.items?.length) {
        setRows(sheet.items.map((item) => ({
          sample_date:    item.sampleDate ? item.sampleDate.slice(0, 10) : "",
          shift:          item.shift || "",
          sampling_by:    item.samplingBy || "",
          sampling_time:  item.samplingTime || "",
          black_particle: item.blackParticle || "",
          bulk_density:   item.bulkDensity || "",
          sieve_residue:  item.sieveResidue || "",
          analysis_by:    item.analysisBy || "",
          remarks:        item.remarks || ""
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

  const addRow = () => setRows((prev) => [...prev, emptyQcRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const onSave = async () => {
    if (!record || saving) return;
    setSaving(true);
    try {
      await api.post(`/production/${record.id}/qc`, {
        product_name: productName || null,
        grade: grade || null,
        batch_no: batchNo || null,
        overall_result: overallResult,
        approved_by: approvedBy || null,
        items: rows.filter((row) => row.shift.trim() || row.sampling_by.trim() || row.black_particle.trim() || row.bulk_density.trim() || row.sieve_residue.trim())
      });
      dispatchUserMessage("QC test sheet saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save QC test sheet");
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

  const canRecord = ["COMPLETED", "PARTIALLY_PRODUCED"].includes(record.status);

  return (
    <div className="order-page">
      <ProductionStepNav record={record} activeStep="qc-test-sheet" />

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Finished Product Test Sheet (QC)
        </h3>
        {!canRecord ? (
          <p style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0" }}>
            The finished product test sheet can be recorded once production has at least a partial produced quantity.
          </p>
        ) : (
          <>
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
                    <th>Date</th>
                    <th>Shift</th>
                    <th>Sampling By</th>
                    <th>Sampling Time</th>
                    <th>Black Particle</th>
                    <th>Bulk Density</th>
                    <th>Sieve Residue</th>
                    <th>Analysis By</th>
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
                          <td><input className="mfg-cell-input" type="date" value={row.sample_date} onChange={(e) => setRowField(index, "sample_date", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.shift} onChange={(e) => setRowField(index, "shift", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.sampling_by} onChange={(e) => setRowField(index, "sampling_by", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.sampling_time} onChange={(e) => setRowField(index, "sampling_time", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.black_particle} onChange={(e) => setRowField(index, "black_particle", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.bulk_density} onChange={(e) => setRowField(index, "bulk_density", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.sieve_residue} onChange={(e) => setRowField(index, "sieve_residue", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.analysis_by} onChange={(e) => setRowField(index, "analysis_by", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.remarks} onChange={(e) => setRowField(index, "remarks", e.target.value)} /></td>
                          <td>
                            <button className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{row.sample_date || "-"}</td>
                          <td>{row.shift || "-"}</td>
                          <td>{row.sampling_by || "-"}</td>
                          <td>{row.sampling_time || "-"}</td>
                          <td>{row.black_particle || "-"}</td>
                          <td>{row.bulk_density || "-"}</td>
                          <td>{row.sieve_residue || "-"}</td>
                          <td>{row.analysis_by || "-"}</td>
                          <td>{row.remarks || "-"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canManageProduction && (
              <>
                <button className="order-btn-secondary" style={{ marginTop: 10 }} onClick={addRow}>+ Add Row</button>

                <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginTop: 16, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Overall Result</div>
                    <SearchableSelect
                      options={[
                        { value: "PENDING", label: "Pending" },
                        { value: "PASS", label: "Pass" },
                        { value: "FAIL", label: "Fail" }
                      ]}
                      value={overallResult}
                      onChange={(value) => setOverallResult(value)}
                      placeholder="Select result"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>Approved By</div>
                    <input className="mfg-cell-input" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
                  </div>
                  <button className="order-btn-primary" disabled={saving} onClick={onSave}>
                    {saving ? "Saving..." : "Save QC Test Sheet"}
                  </button>
                </div>
              </>
            )}

            {record.finishedGoodsTestSheet?.overallResult !== "PASS" && (
              <p style={{ marginTop: 12, color: "#d97706", fontSize: 13 }}>
                Dispatch cannot be created for this order until the QC test sheet is saved with an overall result of "Pass".
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default ProductionQcTestSheetPage;
