import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import ManufacturingOrderPrint from "../components/production/ManufacturingOrderPrint";
import { parseMfgData } from "../utils/productionMfg";
import printSheet from "../utils/printSheet";

function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </h3>
  );
}

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
  const { record, loading } = useProductionRecord(id);
  const mfg = useMemo(() => (record ? parseMfgData(record.rawMaterials) : null), [record]);

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

      {/* The Step 1 modal prints itself, but only exists while the batch is being
          filled in. This prints the saved sheet in the same format, any time. */}
      <section className="order-card sheet-action-bar">
        <div className="sheet-action-text">
          <h3>Manufacturing Order</h3>
        </div>
        <button type="button" className="order-btn-secondary" onClick={() => printSheet()}>
          Print Manufacturing Order
        </button>
      </section>
      <ManufacturingOrderPrint record={record} />

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
