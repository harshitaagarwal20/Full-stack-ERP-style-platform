import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { buildSectionPatchPayload, cloneParamRow, defaultProcessParams, emptyParamRow, parseMfgData } from "../utils/productionMfg";

function ProductionProcessParamsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [rows, setRows] = useState(defaultProcessParams());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setRows(mfg.processParams.length ? mfg.processParams.map(cloneParamRow) : defaultProcessParams());
  }, [record]);

  const setRowField = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyParamRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, "processParams", rows);
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Process parameters saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save process parameters");
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
      <ProductionStepNav record={record} activeStep="process-params" />

      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Critical Process Parameters
          </h3>
          {canManageProduction && (
            <button type="button" className="order-btn-secondary" onClick={addRow}>+ Add Row</button>
          )}
        </div>

        <div className="order-table-wrap">
          <table className="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Parameter</th>
                <th>Range</th>
                <th>Done By</th>
                <th>Reviewed By</th>
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
                      <td><input className="mfg-cell-input" value={row.parameter} onChange={(e) => setRowField(index, "parameter", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.range} onChange={(e) => setRowField(index, "range", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.doneBy} onChange={(e) => setRowField(index, "doneBy", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.reviewedBy} onChange={(e) => setRowField(index, "reviewedBy", e.target.value)} /></td>
                      <td><input className="mfg-cell-input" value={row.remark} onChange={(e) => setRowField(index, "remark", e.target.value)} /></td>
                      <td>
                        {rows.length > 1 && (
                          <button type="button" className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{row.parameter || "-"}</td>
                      <td>{row.range || "-"}</td>
                      <td>{row.doneBy || "-"}</td>
                      <td>{row.reviewedBy || "-"}</td>
                      <td>{row.remark || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManageProduction && (
          <button className="order-btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={onSubmit}>
            {saving ? "Saving..." : "Save Process Parameters"}
          </button>
        )}
      </section>
    </div>
  );
}

export default ProductionProcessParamsPage;
