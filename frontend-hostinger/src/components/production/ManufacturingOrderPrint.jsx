import { parseMfgData, formatSpeed } from "../../utils/productionMfg";

// The Manufacturing Order in its printed form, rendered read-only from a saved
// batch. The Step 1 modal prints itself, but that modal only exists while the
// batch is being filled in — this is how the same sheet gets printed later, from
// the Production view page. Hidden on screen (.print-only); the print rules make
// it the page.
const MATERIAL_SECTIONS = [
  { key: "rm",        num: "2", label: "Approved Raw Materials", colLabel: "RM Name" },
  { key: "additives", num: "3", label: "Additives",              colLabel: "Additive" },
  { key: "catalysts", num: "4", label: "Catalyst",               colLabel: "Catalyst" }
];

function Field({ label, value }) {
  return (
    <div className="mfg-field">
      <span className="mfg-label">{label}</span>
      <span className="mfg-print-value">{value || "—"}</span>
    </div>
  );
}

export default function ManufacturingOrderPrint({ record }) {
  if (!record) return null;

  const order = record.order || {};
  const mfg = parseMfgData(record.rawMaterials);

  return (
    <div className="mfg-modal print-only print-root">
      <div className="mfg-header">
        <div className="mfg-header-left">
          <span className="mfg-badge">Manufacturing Order</span>
          <h3 className="mfg-title">{order.product || "Product"}</h3>
          <p className="mfg-subtitle">{order.clientName} &mdash; {order.orderNo}</p>
        </div>
      </div>

      <div className="mfg-summary">
        {[
          { label: "Product",      value: order.product },
          { label: "Grade",        value: order.grade },
          { label: "Quantity",     value: order.quantity ? `${order.quantity} ${order.unit || ""}`.trim() : "" },
          { label: "Packing Size", value: order.packingSize },
          { label: "Packing Type", value: order.packingType },
          { label: "Party",        value: order.clientName }
        ].map(({ label, value }) => (
          <div key={label} className="mfg-summary-item">
            <span className="mfg-summary-label">{label}</span>
            <span className="mfg-summary-value">{value || "-"}</span>
          </div>
        ))}
      </div>

      <div className="mfg-form">
        <div className="mfg-section">
          <div className="mfg-section-header">
            <span className="mfg-section-num">1</span>
            <h4 className="mfg-section-title">Batch &amp; Machine Settings</h4>
          </div>
          <div className="mfg-settings-grid">
            <Field label="Batch No." value={record.batchNo} />
            <Field label="Particle Size" value={record.particleSize} />
            <Field label="ACM Speed" value={formatSpeed(record.acmRpm, mfg.acmRpmUnit)} />
            <Field label="Pulveriser Speed" value={formatSpeed(mfg.pulveriserRpm || record.classifierRpm, mfg.pulveriserRpmUnit)} />
            <Field label="Blower Speed" value={formatSpeed(record.blowerRpm, mfg.blowerRpmUnit)} />
          </div>
        </div>

        {MATERIAL_SECTIONS.map(({ key, num, label, colLabel }) => (
          <div key={key} className="mfg-section">
            <div className="mfg-section-header">
              <span className="mfg-section-num">{num}</span>
              <h4 className="mfg-section-title">{label}</h4>
            </div>
            <table className="mfg-table">
              <thead>
                <tr>
                  <th>{colLabel}</th><th>Supplier Name</th><th>Grade</th>
                  <th>Batch No.</th><th>Qty (kg)</th><th>Shift</th><th>Remark</th>
                </tr>
              </thead>
              <tbody>
                {(mfg[key]?.length ? mfg[key] : [{}]).map((row, i) => (
                  <tr key={i}>
                    <td>{row.name || ""}</td>
                    <td>{row.vendor || ""}</td>
                    <td>{row.grade || ""}</td>
                    <td>{row.batch_no || ""}</td>
                    <td>{row.qty || ""}</td>
                    <td>{row.shift || ""}</td>
                    <td>{row.remark || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div className="mfg-section">
          <div className="mfg-section-header">
            <span className="mfg-section-num">5</span>
            <h4 className="mfg-section-title">Remarks / Order By</h4>
          </div>
          <div className="mfg-print-remarks">{record.remarks || ""}</div>
        </div>
      </div>
    </div>
  );
}
