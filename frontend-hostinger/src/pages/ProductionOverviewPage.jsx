import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import SearchableSelect from "../components/common/SearchableSelect";
import { buildSectionPatchPayload, parseMfgData } from "../utils/productionMfg";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";

function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </h3>
  );
}

// COMPLETED is intentionally excluded — completing a job runs separate logic on
// the Complete page (PUT /production/:id), so this quick edit only covers the
// in-flight statuses.
const STATUS_OPTIONS = [
  { value: "PENDING", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "HOLD", label: "Hold" }
];

const STEP_CARDS = [
  { suffix: "/batch-setup", label: "Batch Setup", describe: (mfg, record) => (record.batchNo ? `Batch ${record.batchNo}` : "Not started") },
  { suffix: "/raw-materials", label: "Raw Materials", describe: (mfg) => `${mfg.rm.length} entr${mfg.rm.length === 1 ? "y" : "ies"}` },
  { suffix: "/additives", label: "Additives", describe: (mfg) => `${mfg.additives.length} entr${mfg.additives.length === 1 ? "y" : "ies"}` },
  { suffix: "/catalyst", label: "Catalyst", describe: (mfg) => `${mfg.catalysts.length} entr${mfg.catalysts.length === 1 ? "y" : "ies"}` },
  { suffix: "/equipment", label: "Equipment", describe: (mfg) => `${mfg.equipment.length} entr${mfg.equipment.length === 1 ? "y" : "ies"}` },
  { suffix: "/process-params", label: "Process Params", describe: (mfg) => `${mfg.processParams.length} entr${mfg.processParams.length === 1 ? "y" : "ies"}` },
  { suffix: "/operation-log", label: "Operation Log", describe: (mfg) => `${mfg.batchLogs.length} entr${mfg.batchLogs.length === 1 ? "y" : "ies"}` },
  { suffix: "/in-process-testing", label: "In-Process Testing", describe: (mfg, record) => `${record.inProcessTestSheet?.items?.length || 0} sample(s) logged` },
  { suffix: "/qc-test-sheet", label: "QC Test Sheet", describe: (mfg, record) => (record.finishedGoodsTestSheet?.overallResult ? `Result: ${record.finishedGoodsTestSheet.overallResult}` : "Not recorded") }
];

function ProductionOverviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const mfg = useMemo(() => (record ? parseMfgData(record.rawMaterials) : null), [record]);

  const [form, setForm] = useState({ batch_no: "", status: "PENDING", remarks: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!record) return;
    setForm({
      batch_no: record.batchNo || "",
      status: record.status === "COMPLETED" ? "IN_PROGRESS" : (record.status || "PENDING"),
      remarks: record.remarks || ""
    });
  }, [record]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      // Preserve the existing manufacturing JSON (pass the current pulveriserRpm
      // section unchanged) and only patch the top-level fields edited here.
      const payload = buildSectionPatchPayload(record, "pulveriserRpm", mfg?.pulveriserRpm ?? "", {
        batch_no: form.batch_no || undefined,
        remarks: form.remarks || undefined,
        status: form.status || undefined
      });
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Production details saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save production details");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <div className="order-skeleton-list">
          <div className="order-skeleton-row" />
          <div className="order-skeleton-row" />
          <div className="order-skeleton-row" />
        </div>
      </div>
    );
  }

  if (!record) return null;

  return (
    <div className="order-page">
      <ProductionStepNav record={record} activeStep="overview" />

      {canManageProduction && (
        <section className="order-card">
          <SectionTitle>Quick Edit</SectionTitle>
          <form onSubmit={onSave} className="order-form-grid">
            <div>
              <label>Batch No.</label>
              <input
                className="input"
                value={form.batch_no}
                placeholder="e.g. BATCH-1"
                onChange={(e) => setField("batch_no", e.target.value)}
              />
            </div>
            <div>
              <label>Status</label>
              <SearchableSelect
                options={STATUS_OPTIONS}
                value={form.status}
                onChange={(value) => setField("status", value)}
                placeholder="Select status"
              />
            </div>
            <div className="full-row">
              <label>Remarks / Order By</label>
              <textarea
                className="input"
                rows={3}
                value={form.remarks}
                placeholder="Additional instructions..."
                onChange={(e) => setField("remarks", e.target.value)}
              />
            </div>
            <div className="full-row">
              <button type="submit" className="order-btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Details"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="order-card">
        <SectionTitle>Production Steps</SectionTitle>
        <div className="po-detail-info-grid">
          {STEP_CARDS.map((step) => (
            <button
              key={step.suffix}
              className="order-btn-secondary"
              style={{ textAlign: "left", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4 }}
              onClick={() => navigate(`/production/${record.id}${step.suffix}`)}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{step.label}</span>
              <span style={{ fontSize: 12, color: "#64748b" }}>{step.describe(mfg, record)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export default ProductionOverviewPage;
