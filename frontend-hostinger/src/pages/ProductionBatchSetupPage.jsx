import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { buildSectionPatchPayload, parseMfgData, SPEED_UNITS } from "../utils/productionMfg";

function emptyForm() {
  return {
    batch_no: "", particle_size: "Fine",
    acm_rpm: "", acm_rpm_unit: "RPM",
    classifier_rpm: "", classifier_rpm_unit: "RPM",
    blower_rpm: "", blower_rpm_unit: "RPM",
    remarks: ""
  };
}

function ProductionBatchSetupPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setForm({
      batch_no: record.batchNo || "",
      particle_size: record.particleSize || "Fine",
      acm_rpm: record.acmRpm ? String(record.acmRpm) : "",
      acm_rpm_unit: mfg.acmRpmUnit,
      classifier_rpm: mfg.pulveriserRpm || (record.classifierRpm ? String(record.classifierRpm) : ""),
      classifier_rpm_unit: mfg.pulveriserRpmUnit,
      blower_rpm: record.blowerRpm ? String(record.blowerRpm) : "",
      blower_rpm_unit: mfg.blowerRpmUnit,
      remarks: record.remarks || ""
    });
  }, [record]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, {
        pulveriserRpm: form.classifier_rpm,
        acmRpmUnit: form.acm_rpm_unit,
        pulveriserRpmUnit: form.classifier_rpm_unit,
        blowerRpmUnit: form.blower_rpm_unit
      }, {
        batch_no: form.batch_no || undefined,
        particle_size: form.particle_size || undefined,
        acm_rpm: form.acm_rpm ? Number(form.acm_rpm) : undefined,
        classifier_rpm: form.classifier_rpm ? Number(form.classifier_rpm) : undefined,
        blower_rpm: form.blower_rpm ? Number(form.blower_rpm) : undefined,
        remarks: form.remarks || undefined
      });
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Batch setup saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save batch setup");
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
      <ProductionStepNav record={record} activeStep="batch-setup" />

      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Batch &amp; Machine Settings
        </h3>
        <form onSubmit={onSubmit} className="order-form-grid">
          <div>
            <label>Batch No. *</label>
            <input autoComplete="off" className="input" value={form.batch_no} onChange={(e) => setField("batch_no", e.target.value)} required disabled={!canManageProduction} />
          </div>
          <div>
            <label>Particle Size</label>
            <input autoComplete="off" className="input" value={form.particle_size} onChange={(e) => setField("particle_size", e.target.value)} disabled={!canManageProduction} />
          </div>
          <div>
            <label>ACM Speed</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoComplete="off" className="input" type="number" min="1" value={form.acm_rpm} onChange={(e) => setField("acm_rpm", e.target.value)} disabled={!canManageProduction} style={{ flex: 1 }} />
              <select className="input" value={form.acm_rpm_unit} onChange={(e) => setField("acm_rpm_unit", e.target.value)} disabled={!canManageProduction} style={{ flex: "0 0 84px" }}>
                {SPEED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Pulveriser Speed</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoComplete="off" className="input" placeholder="e.g. Full / 1500" value={form.classifier_rpm} onChange={(e) => setField("classifier_rpm", e.target.value)} disabled={!canManageProduction} style={{ flex: 1 }} />
              <select className="input" value={form.classifier_rpm_unit} onChange={(e) => setField("classifier_rpm_unit", e.target.value)} disabled={!canManageProduction} style={{ flex: "0 0 84px" }}>
                {SPEED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label>Blower Speed</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input autoComplete="off" className="input" type="number" min="1" value={form.blower_rpm} onChange={(e) => setField("blower_rpm", e.target.value)} disabled={!canManageProduction} style={{ flex: 1 }} />
              <select className="input" value={form.blower_rpm_unit} onChange={(e) => setField("blower_rpm_unit", e.target.value)} disabled={!canManageProduction} style={{ flex: "0 0 84px" }}>
                {SPEED_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="full-row">
            <label>Remarks / Order By</label>
            <textarea className="input" rows={3} value={form.remarks} onChange={(e) => setField("remarks", e.target.value)} disabled={!canManageProduction} placeholder="Additional instructions..." />
          </div>
          {canManageProduction && (
            <div className="full-row">
              <button type="submit" className="order-btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Batch Setup"}
              </button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}

export default ProductionBatchSetupPage;
