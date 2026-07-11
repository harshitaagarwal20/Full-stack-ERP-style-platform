import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { buildSectionPatchPayload, cloneOperationLogRow, emptyOperationLogRow, ensureRows, getOperationMaterialNames, parseMfgData } from "../utils/productionMfg";

function ProductionOperationLogPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [rows, setRows] = useState([emptyOperationLogRow()]);
  const [saving, setSaving] = useState(false);
  const materialNames = getOperationMaterialNames(record?.rawMaterials);

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setRows(ensureRows(mfg.batchLogs.map(cloneOperationLogRow), emptyOperationLogRow));
  }, [record]);

  const setRowField = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyOperationLogRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, "batchLogs", rows);
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Operation log saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save operation log");
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
      <ProductionStepNav record={record} activeStep="operation-log" />

      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Manufacturing Operation Log — Lot-wise Batch Record
          </h3>
          {canManageProduction && (
            <button type="button" className="order-btn-secondary" onClick={addRow}>+ Add Row</button>
          )}
        </div>

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>Lot No.</th>
                <th>Date</th>
                <th>{materialNames[0]} (kg)</th>
                <th>{materialNames[1]} (kg)</th>
                <th>Initial Temp</th>
                <th>Reaction Temp</th>
                <th>Chopper Temp</th>
                <th>Completion Temp</th>
                <th>Done By</th>
                {canManageProduction && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  {canManageProduction ? (
                    <>
                      <td><input className="mfg-cell-input" value={row.lotNo} placeholder={String(index + 1)} onChange={(e) => setRowField(index, "lotNo", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" type="date" value={row.date} onChange={(e) => setRowField(index, "date", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.material1Qty} onChange={(e) => setRowField(index, "material1Qty", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.material2Qty} onChange={(e) => setRowField(index, "material2Qty", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.initialTemp} onChange={(e) => setRowField(index, "initialTemp", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.reactionTemp} onChange={(e) => setRowField(index, "reactionTemp", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.chopperTemp} onChange={(e) => setRowField(index, "chopperTemp", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.completionTemp} onChange={(e) => setRowField(index, "completionTemp", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.doneBy} onChange={(e) => setRowField(index, "doneBy", e.target.value)} /></td>
                      <td>
                        {rows.length > 1 && (
                          <button type="button" className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.lotNo || index + 1}</td>
                      <td>{row.date || "-"}</td>
                      <td>{row.material1Qty || "-"}</td>
                      <td>{row.material2Qty || "-"}</td>
                      <td>{row.initialTemp || "-"}</td>
                      <td>{row.reactionTemp || "-"}</td>
                      <td>{row.chopperTemp || "-"}</td>
                      <td>{row.completionTemp || "-"}</td>
                      <td>{row.doneBy || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManageProduction && (
          <button className="order-btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={onSubmit}>
            {saving ? "Saving..." : "Save Operation Log"}
          </button>
        )}
      </section>
    </div>
  );
}

export default ProductionOperationLogPage;
