import { useNavigate } from "react-router-dom";
import { getStatusClass, getStatusLabel } from "../../utils/productionMfg";

const STEPS = [
  { key: "batch-setup",        label: "Batch Setup",        suffix: "/batch-setup" },
  { key: "raw-materials",      label: "Raw Materials",      suffix: "/raw-materials" },
  { key: "additives",          label: "Additives",          suffix: "/additives" },
  { key: "catalyst",           label: "Catalyst",           suffix: "/catalyst" },
  { key: "equipment",          label: "Equipment",          suffix: "/equipment" },
  { key: "process-params",     label: "Process Params",     suffix: "/process-params" },
  { key: "operation-log",      label: "Operation Log",      suffix: "/operation-log" },
  { key: "in-process-testing", label: "In-Process Testing", suffix: "/in-process-testing" },
  { key: "qc-test-sheet",      label: "QC Test Sheet",      suffix: "/qc-test-sheet" }
];

export default function ProductionStepNav({ record, activeStep }) {
  const navigate = useNavigate();
  const order = record?.order || {};

  return (
    <>
      <section className="order-card po-detail-header">
        <div className="po-detail-header-top">
          <button className="order-btn-secondary" onClick={() => navigate("/production")}>
            ← Production
          </button>
          <div className="po-detail-header-meta">
            <div className="po-detail-title-block">
              <div className="po-detail-number">{order.orderNo || `#${record?.id}`}</div>
              <div className="po-detail-supplier-name">
                {order.clientName || "-"}
                {record?.batchNo && <span style={{ marginLeft: 10, color: "#64748b", fontWeight: 400, fontSize: 13 }}>Batch: {record.batchNo}</span>}
              </div>
            </div>
            <span className={`order-status ${getStatusClass(record?.status)}`}>
              {getStatusLabel(record?.status)}
            </span>
          </div>
        </div>
      </section>

      <section className="order-card">
        <div style={{ display: "flex", gap: "2px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px", flexWrap: "wrap" }}>
          {STEPS.map((step) => (
            <button
              key={step.key}
              onClick={() => navigate(`/production/${record?.id}${step.suffix}`)}
              style={{
                padding: "10px 18px",
                border: "none",
                background: "none",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: activeStep === step.key ? "700" : "400",
                color: activeStep === step.key ? "#1e293b" : "#64748b",
                borderBottom: activeStep === step.key ? "2px solid #1e293b" : "2px solid transparent",
                marginBottom: "-2px",
                whiteSpace: "nowrap"
              }}
            >
              {step.label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
