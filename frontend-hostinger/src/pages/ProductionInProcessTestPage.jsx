import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import SampleFormModal from "../components/production/SampleFormModal";
import SampleList from "../components/production/SampleList";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import printSheet from "../utils/printSheet";
import { nowDate, nowTime } from "../utils/clock";
import { minEntryDateFor } from "../utils/dateRules";

const SHIFT_OPTIONS = ["A", "B", "C"];

// The sheet's fourteen columns, grouped into the few things a person actually
// does at the bench. The printed sheet still carries every one of them — this
// spec only drives how they are entered.
const SECTIONS = [
  {
    title: "Sample",
    fields: [
      { key: "analysis_date", label: "Date of Analysis", type: "date", min: minEntryDateFor },
      { key: "shift",         label: "Shift",            type: "select", options: SHIFT_OPTIONS },
      { key: "lot_no",        label: "Lot No." },
      { key: "reactor_no",    label: "Reactor No." },
      { key: "sampling_by",   label: "Sampling By" },
      { key: "sampling_time", label: "Sampling Time",    type: "time" }
    ]
  },
  {
    title: "Test Parameters",
    fields: [
      { key: "free_fatty_acid", label: "Free Fatty Acid %", type: "decimal" },
      { key: "ash",             label: "Ash",              type: "decimal" },
      { key: "moisture",        label: "Moisture",         type: "decimal" },
      { key: "appearance",      label: "Appearance" },
      { key: "melting_point",   label: "Melting Point" }
    ]
  },
  {
    title: "Sign-off",
    fields: [
      { key: "analysis_by",     label: "Analysis By" },
      // The paper form spells this out as "Informed to Production"; the printed
      // sheet still does. In a half-width field on a phone it only wraps.
      { key: "ffa_inform_time", label: "FFA Inform Time", type: "time" },
      { key: "remarks",         label: "Remark", wide: true }
    ]
  }
];

function emptyInProcessRow() {
  return {
    analysis_date: nowDate(), shift: "", lot_no: "", reactor_no: "", sampling_by: "", sampling_time: nowTime(),
    free_fatty_acid: "", ash: "", moisture: "", appearance: "", melting_point: "",
    analysis_by: "", ffa_inform_time: "", remarks: ""
  };
}

// A row counts as a real sample only once someone has actually recorded
// something on it — the auto-filled date and time alone do not make one.
function hasContent(row) {
  return Boolean(
    row.shift.trim() || row.lot_no.trim() || row.reactor_no.trim() || row.sampling_by.trim() ||
    row.free_fatty_acid.trim() || row.ash.trim() || row.moisture.trim() || row.appearance.trim()
  );
}

function summarize(row) {
  const primary = [
    row.analysis_date || "—",
    row.shift ? `Shift ${row.shift}` : null,
    row.lot_no ? `Lot ${row.lot_no}` : null
  ].filter(Boolean).join(" · ");

  const readings = [
    row.free_fatty_acid ? `FFA ${row.free_fatty_acid}` : null,
    row.ash ? `Ash ${row.ash}` : null,
    row.moisture ? `Moisture ${row.moisture}` : null
  ].filter(Boolean);

  return { primary, secondary: readings.length ? readings.join(" · ") : "No readings yet" };
}

function ProductionInProcessTestPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);

  const [rows, setRows] = useState([]);
  const [productName, setProductName] = useState("");
  const [grade, setGrade] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [overallResult, setOverallResult] = useState("PENDING");
  const [approvedBy, setApprovedBy] = useState("");
  const [saving, setSaving] = useState(false);

  // Which sample the form is open on: an index to edit, or "new".
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);

  // Arriving from the list page's "+ Add Entry" picker: open straight onto a
  // fresh sample. Only on the first load — a reload after saving must not reopen.
  const pendingAddRow = useRef(Boolean(state?.addRow));

  useEffect(() => {
    if (!record) return;
    const sheet = record.inProcessTestSheet;
    if (sheet) {
      setProductName(sheet.productName || "");
      setGrade(sheet.grade || "");
      setBatchNo(sheet.batchNo || "");
      setOverallResult(sheet.overallResult || "PENDING");
      setApprovedBy(sheet.approvedBy || "");
      if (sheet.items?.length) {
        setRows(sheet.items.map((item) => ({
          analysis_date:   item.analysisDate ? item.analysisDate.slice(0, 10) : "",
          shift:           item.shift || "",
          lot_no:          item.lotNo || "",
          reactor_no:      item.reactorNo || "",
          sampling_by:     item.samplingBy || "",
          sampling_time:   item.samplingTime || "",
          free_fatty_acid: item.freeFattyAcid || "",
          ash:             item.ash || "",
          moisture:        item.moisture || "",
          appearance:      item.appearance || "",
          melting_point:   item.meltingPoint || "",
          analysis_by:     item.analysisBy || "",
          ffa_inform_time: item.ffaInformTime || "",
          remarks:         item.remarks || ""
        })));
      }
    } else {
      setProductName(record.productSpecs || "");
      setBatchNo(record.batchNo || "");
    }

    if (pendingAddRow.current) {
      pendingAddRow.current = false;
      setDraft(emptyInProcessRow());
      setEditing("new");
    }
  }, [record]);

  const openNew = () => {
    setDraft(emptyInProcessRow());
    setEditing("new");
  };

  const openEdit = (index) => {
    setDraft(rows[index]);
    setEditing(index);
  };

  const closeForm = () => {
    setEditing(null);
    setDraft(null);
  };

  const commitSample = (sample) => {
    setRows((prev) => (
      editing === "new"
        ? [...prev, sample]
        : prev.map((row, i) => (i === editing ? sample : row))
    ));
    closeForm();
  };

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const onSave = async () => {
    if (!record || saving) return;
    setSaving(true);
    try {
      await api.post(`/production/${record.id}/in-process-test`, {
        product_name: productName || null,
        grade: grade || null,
        batch_no: batchNo || null,
        overall_result: overallResult,
        approved_by: approvedBy || null,
        items: rows.filter(hasContent)
      });
      dispatchUserMessage(
        overallResult === "FAIL"
          ? "In-process check failed — the batch has been sent to rework and cannot be packed."
          : "In-process test sheet saved.",
        { title: "Saved", variant: overallResult === "FAIL" ? "error" : "success" }
      );
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save in-process test sheet");
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
      <ProductionStepNav record={record} activeStep="in-process-testing" />

      <section className="order-card">
        <div className="mfg-doc-toolbar">
          <button type="button" className="order-btn-secondary" onClick={() => printSheet()}>
            Print Sheet
          </button>
        </div>

        <h3 className="sample-heading">In-Process Product Test Sheet</h3>

        <div className="sample-header-fields">
          <label>
            <span>Product Name</span>
            <input autoComplete="off" className="input" value={productName} onChange={(e) => setProductName(e.target.value)} disabled={!canManageProduction} />
          </label>
          <label>
            <span>Grade</span>
            <input autoComplete="off" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} disabled={!canManageProduction} />
          </label>
          <label>
            <span>Batch No.</span>
            <input autoComplete="off" className="input" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} disabled={!canManageProduction} />
          </label>
        </div>

        <SampleList
          rows={rows}
          summarize={summarize}
          onAdd={openNew}
          onEdit={openEdit}
          onRemove={removeRow}
          readOnly={!canManageProduction}
        />

        {/* The quality decision on this sheet. Leaving it Pending keeps the sheet
            a running log; a Fail sends the batch to rework before packing. */}
        <div className="mfg-verdict">
          <div className="mfg-verdict-field">
            <label className="label">In-process check result</label>
            <select
              className="input"
              value={overallResult}
              onChange={(e) => setOverallResult(e.target.value)}
              disabled={!canManageProduction}
            >
              <option value="PENDING">Pending — still sampling</option>
              <option value="PASS">Approved — batch may continue</option>
              <option value="FAIL">Rejected — send to rework</option>
            </select>
          </div>
          <div className="mfg-verdict-field">
            <label className="label">Checked by</label>
            <input
              autoComplete="off"
              className="input"
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              disabled={!canManageProduction}
            />
          </div>
          {overallResult === "FAIL" && (
            <p className="mfg-verdict-warn">
              Saving a rejection parks this batch in rework. It cannot be produced onward or packed
              until production works it again.
            </p>
          )}
        </div>

        {canManageProduction && (
          <div className="sample-actions">
            <button className="order-btn-primary" disabled={saving} onClick={onSave}>
              {saving ? "Saving..." : "Save In-Process Test Sheet"}
            </button>
          </div>
        )}
      </section>

      {editing !== null && (
        <SampleFormModal
          title={editing === "new" ? "Add Sample" : `Edit Sample #${editing + 1}`}
          sections={SECTIONS}
          value={draft}
          onSave={commitSample}
          onCancel={closeForm}
        />
      )}

      {/* The controlled paper form. Never shown on screen — it exists so the
          printout keeps its official layout no matter how the data was entered.
          Plain text, not inputs: nothing here is filled in, it is only rendered. */}
      <div className="mfg-doc print-root print-only">
        <div className="mfg-doc-top">
          <div className="mfg-doc-top-title">
            <h3 className="mfg-doc-title">In-Process Product Test Sheet</h3>
          </div>
          <div className="mfg-doc-top-brand">
            <img src="/logo.png" alt="Nimbasia Stabilizers" />
          </div>
          <div className="mfg-doc-top-org">
            <div className="mfg-doc-org-cell">Nimbasia Stabilizers</div>
            <div className="mfg-doc-org-cell">Kota</div>
          </div>
        </div>

        <div className="mfg-doc-fields">
          <label><span>Product Name :</span><span className="mfg-doc-line">{productName}</span></label>
          <label><span>Grade :</span><span className="mfg-doc-line">{grade}</span></label>
          <label><span>Batch No. :</span><span className="mfg-doc-line">{batchNo}</span></label>
        </div>

        <div className="mfg-sheet-wrap">
          <table className="order-table mfg-sheet-table">
            <thead>
              <tr>
                <th rowSpan={2}>#</th>
                <th rowSpan={2}>Date of Analysis</th>
                <th rowSpan={2}>Shift</th>
                <th rowSpan={2}>Lot No.</th>
                <th rowSpan={2}>Reactor No.</th>
                <th rowSpan={2}>Sampling By</th>
                <th rowSpan={2}>Sampling Time</th>
                <th colSpan={5} className="mfg-group-th">Test Parameter</th>
                <th rowSpan={2}>Analysis By</th>
                <th rowSpan={2}>FFA Inform Time<br /><small>(Informed to Production)</small></th>
                <th rowSpan={2}>Remark</th>
              </tr>
              <tr>
                <th>Free Fatty Acid %</th>
                <th>Ash</th>
                <th>Moisture</th>
                <th>Appearance</th>
                <th>Melting Point</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(hasContent).map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{row.analysis_date || "-"}</td>
                  <td>{row.shift || "-"}</td>
                  <td>{row.lot_no || "-"}</td>
                  <td>{row.reactor_no || "-"}</td>
                  <td>{row.sampling_by || "-"}</td>
                  <td>{row.sampling_time || "-"}</td>
                  <td>{row.free_fatty_acid || "-"}</td>
                  <td>{row.ash || "-"}</td>
                  <td>{row.moisture || "-"}</td>
                  <td>{row.appearance || "-"}</td>
                  <td>{row.melting_point || "-"}</td>
                  <td>{row.analysis_by || "-"}</td>
                  <td>{row.ffa_inform_time || "-"}</td>
                  <td>{row.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mfg-doc-signoff">
          <span>Result : {overallResult}</span>
          <span>Checked by : {approvedBy || "—"}</span>
        </div>
      </div>
    </div>
  );
}

export default ProductionInProcessTestPage;
