import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import SearchableSelect from "../components/common/SearchableSelect";
import SampleFormModal from "../components/production/SampleFormModal";
import SampleList from "../components/production/SampleList";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import printSheet from "../utils/printSheet";
import { nowDate, nowTime } from "../utils/clock";
import { minEntryDateFor } from "../utils/dateRules";

// Mirrors the controlled paper form QCD/021/F/001-00.
const SHIFT_OPTIONS = ["A", "B", "C"];

// The sheet's columns, grouped into the few things a person actually does at the
// bench. The printed sheet still carries every one of them — this spec only
// drives how they are entered.
const SECTIONS = [
  {
    title: "Sample",
    fields: [
      { key: "sample_date",   label: "Date",          type: "date", min: minEntryDateFor },
      { key: "shift",         label: "Shift",         type: "select", options: SHIFT_OPTIONS },
      { key: "sampling_by",   label: "Sampling By" },
      { key: "sampling_time", label: "Sampling Time", type: "time" }
    ]
  },
  {
    title: "Test Parameters",
    fields: [
      { key: "black_particle", label: "Black Particle" },
      { key: "bulk_density",   label: "Bulk Density",  type: "decimal" },
      { key: "sieve_residue",  label: "Sieve Residue", type: "decimal" }
    ]
  },
  {
    title: "Sign-off",
    fields: [
      { key: "analysis_by", label: "Analysis By" },
      { key: "approved_by", label: "Approved By" },
      { key: "remarks",     label: "Remark", wide: true }
    ]
  }
];

function emptyQcRow() {
  return {
    sample_date: nowDate(), shift: "", sampling_by: "", sampling_time: nowTime(),
    black_particle: "", bulk_density: "", sieve_residue: "", analysis_by: "", approved_by: "", remarks: ""
  };
}

// A row counts as a real sample only once someone has actually recorded
// something on it — the auto-filled date and time alone do not make one.
function hasContent(row) {
  return Boolean(
    row.shift.trim() || row.sampling_by.trim() || row.black_particle.trim() ||
    row.bulk_density.trim() || row.sieve_residue.trim() || row.analysis_by.trim() || row.approved_by.trim()
  );
}

function summarize(row) {
  const primary = [
    row.sample_date || "—",
    row.shift ? `Shift ${row.shift}` : null
  ].filter(Boolean).join(" · ");

  const readings = [
    row.black_particle ? `Black ${row.black_particle}` : null,
    row.bulk_density ? `Bulk density ${row.bulk_density}` : null,
    row.sieve_residue ? `Sieve ${row.sieve_residue}` : null
  ].filter(Boolean);

  return { primary, secondary: readings.length ? readings.join(" · ") : "No readings yet" };
}

function ProductionQcTestSheetPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);

  const [rows, setRows] = useState([]);
  const [overallResult, setOverallResult] = useState("PENDING");
  const [approvedBy, setApprovedBy] = useState("");
  const [productName, setProductName] = useState("");
  const [grade, setGrade] = useState("");
  const [batchNo, setBatchNo] = useState("");
  const [saving, setSaving] = useState(false);

  // Which sample the form is open on: an index to edit, or "new".
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);

  // Arriving from the list page's "+ Add Entry" picker: open straight onto a
  // fresh sample. Only on the first load — a reload after saving must not reopen.
  const pendingAddRow = useRef(Boolean(state?.addRow));

  useEffect(() => {
    if (!record) return;
    const sheet = record.finishedGoodsTestSheet;
    if (sheet) {
      setOverallResult(sheet.overallResult || "PENDING");
      setApprovedBy(sheet.approvedBy || "");
      setProductName(sheet.productName || "");
      setGrade(sheet.grade || "");
      setBatchNo(sheet.batchNo || "");
      if (sheet.items?.length) {
        setRows(sheet.items.map((item) => ({
          sample_date:    item.sampleDate ? item.sampleDate.slice(0, 10) : "",
          shift:          item.shift || "",
          sampling_by:    item.samplingBy || "",
          sampling_time:  item.samplingTime || "",
          black_particle: item.blackParticle || "",
          bulk_density:   item.bulkDensity || "",
          sieve_residue:  item.sieveResidue || "",
          analysis_by:    item.analysisBy || "",
          approved_by:    item.approvedBy || "",
          remarks:        item.remarks || ""
        })));
      }
    } else {
      setProductName(record.productSpecs || "");
      setBatchNo(record.batchNo || "");
    }

    if (pendingAddRow.current) {
      pendingAddRow.current = false;
      setDraft(emptyQcRow());
      setEditing("new");
    }
  }, [record]);

  const openNew = () => {
    setDraft(emptyQcRow());
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
      await api.post(`/production/${record.id}/qc`, {
        product_name: productName || null,
        grade: grade || null,
        batch_no: batchNo || null,
        overall_result: overallResult,
        approved_by: approvedBy || null,
        items: rows.filter(hasContent)
      });
      dispatchUserMessage("QC test sheet saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save QC test sheet");
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

  const canRecord = ["COMPLETED", "PARTIALLY_PRODUCED"].includes(record.status);

  return (
    <div className="order-page">
      <ProductionStepNav record={record} activeStep="qc-test-sheet" />

      <section className="order-card">
        {!canRecord ? (
          <p style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0" }}>
            The finished product test sheet can be recorded once production has at least a partial produced quantity.
          </p>
        ) : (
          <>
            <div className="mfg-doc-toolbar">
              <button type="button" className="order-btn-secondary" onClick={() => printSheet()}>
                Print Sheet
              </button>
            </div>

            <h3 className="sample-heading">Finished Product Test Sheet</h3>

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

            {canManageProduction && (
              <div className="mfg-verdict">
                <div className="mfg-verdict-field">
                  <label className="label">Overall Result</label>
                  <SearchableSelect
                    options={[
                      { value: "PENDING", label: "Pending" },
                      { value: "PASS", label: "Pass" },
                      { value: "FAIL", label: "Fail" }
                    ]}
                    value={overallResult}
                    onChange={(value) => setOverallResult(value)}
                    placeholder="Select result"
                  />
                </div>
                <div className="mfg-verdict-field">
                  <label className="label">Approved By</label>
                  <input className="input" autoComplete="off" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} />
                </div>
              </div>
            )}

            {canManageProduction && (
              <div className="sample-actions">
                <button className="order-btn-primary" disabled={saving} onClick={onSave}>
                  {saving ? "Saving..." : "Save QC Test Sheet"}
                </button>
              </div>
            )}

            {record.finishedGoodsTestSheet?.overallResult !== "PASS" && (
              <p style={{ marginTop: 12, color: "#d97706", fontSize: 13 }}>
                Dispatch cannot be created for this order until the QC test sheet is saved with an overall result of "Pass".
              </p>
            )}
          </>
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

      {/* The controlled paper form (QCD/021/F/001-00). Never shown on screen — it
          exists so the printout keeps its official layout no matter how the data
          was entered. Plain text, not inputs: it is only rendered, never filled. */}
      <div className="mfg-doc print-root print-only">
        <div className="mfg-doc-top">
          <div className="mfg-doc-top-title">
            <h3 className="mfg-doc-title">Finished Product Test Sheet</h3>
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
                <th rowSpan={2}>Sr. No.</th>
                <th rowSpan={2}>Date</th>
                <th rowSpan={2}>Shift</th>
                <th rowSpan={2}>Sampling By</th>
                <th rowSpan={2}>Sampling Time</th>
                <th colSpan={3} className="mfg-group-th">Test Parameter</th>
                <th rowSpan={2}>Analysis By</th>
                <th rowSpan={2}>Approved By</th>
                <th rowSpan={2}>Remark</th>
              </tr>
              <tr>
                <th>Black Particle</th>
                <th>Bulk Density</th>
                <th>Sieve Residue</th>
              </tr>
            </thead>
            <tbody>
              {rows.filter(hasContent).map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{row.sample_date || "-"}</td>
                  <td>{row.shift || "-"}</td>
                  <td>{row.sampling_by || "-"}</td>
                  <td>{row.sampling_time || "-"}</td>
                  <td>{row.black_particle || "-"}</td>
                  <td>{row.bulk_density || "-"}</td>
                  <td>{row.sieve_residue || "-"}</td>
                  <td>{row.analysis_by || "-"}</td>
                  <td>{row.approved_by || "-"}</td>
                  <td>{row.remarks || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mfg-doc-signoff">
          <span>Overall Result : {overallResult}</span>
          <span>Approved by : {approvedBy || "—"}</span>
        </div>
      </div>
    </div>
  );
}

export default ProductionQcTestSheetPage;
