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
import { buildSectionPatchPayload, cloneOperationLogRow, emptyOperationLogRow, getOperationMaterialNames, parseMfgData } from "../utils/productionMfg";
import { nowDate } from "../utils/clock";
import { minEntryDateFor } from "../utils/dateRules";

function ProductionOperationLogPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const materialNames = getOperationMaterialNames(record?.rawMaterials);

  // Which lot the form is open on: an index to edit, or "new".
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(null);

  // Arriving from the list page's "+ Add Entry" picker: open straight onto a
  // fresh lot. Only on the first load — a reload after saving must not reopen.
  const pendingAddRow = useRef(Boolean(state?.addRow));

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setRows(mfg.batchLogs.map(cloneOperationLogRow));

    if (pendingAddRow.current) {
      pendingAddRow.current = false;
      setDraft({ ...emptyOperationLogRow(), date: nowDate() });
      setEditing("new");
    }
  }, [record]);

  // The log's nine columns, grouped into what happens at the reactor: which lot,
  // what went in, how it ran, who ran it.
  const SECTIONS = [
    {
      title: "Lot",
      fields: [
        { key: "lotNo", label: "Lot No." },
        { key: "date",  label: "Date", type: "date", min: minEntryDateFor }
      ]
    },
    {
      title: "Charge",
      fields: [
        { key: "material1Qty", label: `${materialNames[0]} (kg)`, type: "decimal" },
        { key: "material2Qty", label: `${materialNames[1]} (kg)`, type: "decimal" }
      ]
    },
    {
      title: "Temperatures",
      fields: [
        { key: "initialTemp",    label: "Initial Temp" },
        { key: "reactionTemp",   label: "Reaction Temp" },
        { key: "chopperTemp",    label: "Chopper Temp" },
        { key: "completionTemp", label: "Completion Temp" }
      ]
    },
    {
      title: "Sign-off",
      fields: [
        { key: "doneBy", label: "Done By", wide: true }
      ]
    }
  ];

  const summarize = (row) => {
    const primary = [
      row.lotNo ? `Lot ${row.lotNo}` : "Lot —",
      row.date || null
    ].filter(Boolean).join(" · ");

    const charge = [
      row.material1Qty ? `${materialNames[0]} ${row.material1Qty}kg` : null,
      row.material2Qty ? `${materialNames[1]} ${row.material2Qty}kg` : null
    ].filter(Boolean);

    return { primary, secondary: charge.length ? charge.join(" · ") : "Nothing charged yet" };
  };

  const openNew = () => {
    setDraft({ ...emptyOperationLogRow(), date: nowDate() });
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

  const commitRow = (row) => {
    setRows((prev) => (
      editing === "new"
        ? [...prev, row]
        : prev.map((existing, i) => (i === editing ? row : existing))
    ));
    closeForm();
  };

  const removeRow = (index) => setRows((prev) => prev.filter((_, i) => i !== index));

  const onSubmit = async () => {
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, "batchLogs", rows);
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage("Operation log saved.", { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to save operation log");
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
      <ProductionStepNav record={record} activeStep="operation-log" />

      <section className="order-card">
        <h3 className="sample-heading">
          Manufacturing Operation Log — Lot-wise Batch Record
        </h3>

        {/* Read-only for anyone who cannot edit: the full record, stacked into a
            card per lot on a phone. */}
        {canManageProduction ? (
          <SampleList
            rows={rows}
            summarize={summarize}
            onAdd={openNew}
            onEdit={openEdit}
            onRemove={removeRow}
          />
        ) : (
          <div className="responsive-table-wrap">
            <table className="order-table responsive-table">
              <thead>
                <tr>
                  <th>Lot No.</th>
                  <th>Date</th>
                  <th>{materialNames[0]} (kg)</th>
                  <th>{materialNames[1]} (kg)</th>
                  <th>Initial Temp</th>
                  <th>Reaction Temp</th>
                  <th>Chopper Temp</th>
                  <th>Completion Temp</th>
                  <th>Done By</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td data-label="Lot No.">{row.lotNo || index + 1}</td>
                    <td data-label="Date">{row.date || "-"}</td>
                    <td data-label={`${materialNames[0]} (kg)`}>{row.material1Qty || "-"}</td>
                    <td data-label={`${materialNames[1]} (kg)`}>{row.material2Qty || "-"}</td>
                    <td data-label="Initial Temp">{row.initialTemp || "-"}</td>
                    <td data-label="Reaction Temp">{row.reactionTemp || "-"}</td>
                    <td data-label="Chopper Temp">{row.chopperTemp || "-"}</td>
                    <td data-label="Completion Temp">{row.completionTemp || "-"}</td>
                    <td data-label="Done By">{row.doneBy || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManageProduction && (
          <div className="sample-actions">
            <button className="order-btn-primary" disabled={saving} onClick={onSubmit}>
              {saving ? "Saving..." : "Save Operation Log"}
            </button>
          </div>
        )}
      </section>

      {editing !== null && (
        <SampleFormModal
          title={editing === "new" ? "Add Lot" : `Edit Lot #${editing + 1}`}
          sections={SECTIONS}
          value={draft}
          onSave={commitRow}
          onCancel={closeForm}
        />
      )}
    </div>
  );
}

export default ProductionOperationLogPage;
