import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../../hooks/useIsMobile";
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

/* Desktop: all nine steps on one scrolling rail, since there is room to show them. */
function StepRail({ recordId, activeStep, navigate }) {
  const trackRef = useRef(null);
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const syncOverflow = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setOverflow({
      start: track.scrollLeft > 4,
      end: max > 4 && track.scrollLeft < max - 4
    });
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.querySelector('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "center"
    });
    syncOverflow();
    window.addEventListener("resize", syncOverflow);
    return () => window.removeEventListener("resize", syncOverflow);
  }, [activeStep, syncOverflow]);

  return (
    <nav
      className="prod-step-rail"
      aria-label="Batch steps"
      data-overflow-start={overflow.start}
      data-overflow-end={overflow.end}
    >
      <div className="prod-step-rail-track" ref={trackRef} onScroll={syncOverflow}>
        {STEPS.map((step, index) => (
          <button
            key={step.key}
            className="prod-tab"
            aria-current={activeStep === step.key ? "page" : undefined}
            onClick={() => navigate(`/production/${recordId}${step.suffix}`)}
          >
            <span className="prod-step-num">{index + 1}</span>
            {step.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* Mobile: a phone cannot show nine tabs without hiding most of them, so the rail
   collapses to the current step plus step-through arrows. The full list is one tap
   away in a sheet, which beats a sideways scroll nobody notices is scrollable. */
function StepSelector({ recordId, activeStep, navigate }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.key === activeStep));
  const current = STEPS[activeIndex];

  const go = (index) => {
    setSheetOpen(false);
    navigate(`/production/${recordId}${STEPS[index].suffix}`);
  };

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e) => e.key === "Escape" && setSheetOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [sheetOpen]);

  return (
    <>
      <nav className="prod-step-selector" aria-label="Batch steps">
        <button
          className="prod-step-arrow"
          onClick={() => go(activeIndex - 1)}
          disabled={activeIndex === 0}
          aria-label="Previous step"
        >
          ‹
        </button>

        <button
          className="prod-step-current"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
        >
          <span className="prod-step-current-count">
            Step {activeIndex + 1} of {STEPS.length}
          </span>
          <span className="prod-step-current-label">
            {current.label}
            <span className="prod-step-caret" aria-hidden="true">▾</span>
          </span>
          <span className="prod-step-progress" aria-hidden="true">
            <span style={{ width: `${((activeIndex + 1) / STEPS.length) * 100}%` }} />
          </span>
        </button>

        <button
          className="prod-step-arrow"
          onClick={() => go(activeIndex + 1)}
          disabled={activeIndex === STEPS.length - 1}
          aria-label="Next step"
        >
          ›
        </button>
      </nav>

      {/* Portalled to <body>: as a child of the step card the sheet inherits that
          card's stacking and overflow context, which clips a fixed overlay instead
          of letting it cover the viewport. */}
      {sheetOpen &&
        createPortal(
          <div className="prod-step-sheet-backdrop" onClick={() => setSheetOpen(false)}>
            <div
              className="prod-step-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Jump to step"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="prod-step-sheet-grip" aria-hidden="true" />
              <div className="prod-step-sheet-title">Jump to step</div>
              {STEPS.map((step, index) => (
                <button
                  key={step.key}
                  className="prod-step-sheet-item"
                  aria-current={index === activeIndex ? "page" : undefined}
                  onClick={() => go(index)}
                >
                  <span className="prod-step-num">{index + 1}</span>
                  {step.label}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default function ProductionStepNav({ record, activeStep }) {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
        {isMobile ? (
          <StepSelector recordId={record?.id} activeStep={activeStep} navigate={navigate} />
        ) : (
          <StepRail recordId={record?.id} activeStep={activeStep} navigate={navigate} />
        )}
      </section>
    </>
  );
}
