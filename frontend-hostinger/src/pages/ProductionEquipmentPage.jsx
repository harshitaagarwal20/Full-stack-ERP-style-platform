import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { buildSectionPatchPayload, cloneEquipRow, emptyEquipRow, parseMfgData } from "../utils/productionMfg";

function ProductionEquipmentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [rows, setRows] = useState([emptyEquipRow()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setRows(mfg.equipment.length ? mfg.equipment.map(cloneEquipRow) : [emptyEquipRow()]);
  }, [record]);

  const setRowField = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addRow = () => setRows((prev) => [...prev, emptyEquipRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, "equipment", rows);
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Equipment saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save equipment");
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
      <ProductionStepNav record={record} activeStep="equipment" />

      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Equipment Used in Production Line
          </h3>
          {canManageProduction && (
            <button type="button" className="order-btn-secondary" onClick={addRow}>+ Add Row</button>
          )}
        </div>

        <div className="responsive-table-wrap">
          <table className="order-table responsive-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Equipment Name</th>
                <th>Equipment ID No.</th>
                <th>Capacity</th>
                {canManageProduction && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td data-label="#" style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                  {canManageProduction ? (
                    <>
                      <td data-label="Equipment Name"><input className="mfg-cell-input" autoComplete="off" value={row.name} onChange={(e) => setRowField(index, "name", e.target.value)} /></td>
                      <td data-label="Equipment ID No."><input className="mfg-cell-input" autoComplete="off" value={row.equipId} onChange={(e) => setRowField(index, "equipId", e.target.value)} /></td>
                      <td data-label="Capacity"><input className="mfg-cell-input" autoComplete="off" value={row.capacity} onChange={(e) => setRowField(index, "capacity", e.target.value)} /></td>
                      <td data-label="">
                        {rows.length > 1 && (
                          <button type="button" className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td data-label="Equipment Name">{row.name || "-"}</td>
                      <td data-label="Equipment ID No.">{row.equipId || "-"}</td>
                      <td data-label="Capacity">{row.capacity || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManageProduction && (
          <button className="order-btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={onSubmit}>
            {saving ? "Saving..." : "Save Equipment"}
          </button>
        )}
      </section>
    </div>
  );
}

export default ProductionEquipmentPage;
