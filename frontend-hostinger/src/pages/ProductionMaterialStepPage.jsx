import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosClient";
import useKnownItemIds from "../hooks/useKnownItemIds";
import useMasterData from "../hooks/useMasterData";
import useProductionRecord from "../hooks/useProductionRecord";
import ProductionStepNav from "../components/production/ProductionStepNav";
import SearchableSelect from "../components/common/SearchableSelect";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { buildSectionPatchPayload, cloneMaterialRow, emptyMaterialRow, ensureRows, parseMfgData } from "../utils/productionMfg";

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function getBatchAutoFill(batches, batchNo = "") {
  const list = Array.isArray(batches) ? batches : [];
  const selectedBatchNo = String(batchNo || "").trim();
  const selected = selectedBatchNo ? list.find((batch) => batch.batchNo === selectedBatchNo) : null;
  if (selected) {
    return {
      batch_no: selected.batchNo || "",
      vendor: selected.vendor || "",
      grade: selected.grade || ""
    };
  }

  if (list.length === 1) {
    return {
      batch_no: list[0].batchNo || "",
      vendor: list[0].vendor || "",
      grade: list[0].grade || ""
    };
  }

  const suppliers = [...new Set(list.map((batch) => String(batch.vendor || "").trim()).filter(Boolean))];
  const grades = [...new Set(list.map((batch) => String(batch.grade || "").trim()).filter(Boolean))];
  return {
    batch_no: "",
    vendor: suppliers.length === 1 ? suppliers[0] : "",
    grade: grades.length === 1 ? grades[0] : ""
  };
}

function emptySubstituteForm(row) {
  return {
    substitute_item_id: "",
    substitute_batch_no: "",
    substitute_vendor: row?.vendor || "",
    substitute_grade: row?.grade || "",
    reason: ""
  };
}

function ProductionMaterialStepPage({ section, stepKey, label, colLabel }) {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageProduction = ["admin", "production"].includes(user?.role);
  const { record, loading, reload } = useProductionRecord(id);
  const [rows, setRows] = useState([emptyMaterialRow()]);
  const [saving, setSaving] = useState(false);
  const [substitutingIndex, setSubstitutingIndex] = useState(null);
  const [substituteForm, setSubstituteForm] = useState(emptySubstituteForm());
  const [submittingSubstitution, setSubmittingSubstitution] = useState(false);

  const knownItemIds = useKnownItemIds();
  const knownItemIdOptions = useMemo(
    () => knownItemIds.map((itemId) => ({ value: itemId, label: itemId })),
    [knownItemIds]
  );
  const masterData = useMasterData();
  const rawMaterialOptions = useMemo(() => {
    const catalog = Array.isArray(masterData.rawMaterialsCatalog) ? masterData.rawMaterialsCatalog : [];
    if (catalog.length > 0) return catalog;
    return knownItemIdOptions;
  }, [knownItemIdOptions, masterData.rawMaterialsCatalog]);
  const materialOptions = section === "rm" ? rawMaterialOptions : knownItemIdOptions;
  const supplierOptions = useMemo(() => {
    const supplierMaster = Array.isArray(masterData.supplierMaster) ? masterData.supplierMaster : [];
    return supplierMaster.map((s) => ({
      value: s.supplierName,
      label: s.supplierName,
      searchText: [s.supplierName, s.supplierCode].filter(Boolean).join(" ")
    }));
  }, [masterData.supplierMaster]);

  useEffect(() => {
    if (!record) return;
    const mfg = parseMfgData(record.rawMaterials);
    setRows(ensureRows(mfg[section].map(cloneMaterialRow), emptyMaterialRow));
  }, [record, section]);

  // Supplier/grade/batch already on file from whatever GRN actually received
  // this item, so the operator can pick a batch instead of retyping details.
  const [batchOptionsByItem, setBatchOptionsByItem] = useState({});
  const ensureBatchOptions = async (itemName) => {
    const key = String(itemName || "").trim();
    if (!key) return [];
    if (batchOptionsByItem[key]) return batchOptionsByItem[key];
    try {
      const { data } = await api.get("/inventory/item-batches", { params: { itemId: key } });
      const batches = Array.isArray(data.batches) ? data.batches : [];
      setBatchOptionsByItem((prev) => ({ ...prev, [key]: batches }));
      return batches;
    } catch {
      setBatchOptionsByItem((prev) => ({ ...prev, [key]: [] }));
      return [];
    }
  };

  useEffect(() => {
    rows.forEach((row) => {
      if (row.name) ensureBatchOptions(row.name);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((r) => r.name).join("|")]);

  const setRowField = (index, key, value) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const patchRow = (index, patch) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleItemChange = async (index, value) => {
    patchRow(index, { name: value, batch_no: "", vendor: "", grade: "" });
    const batches = await ensureBatchOptions(value);
    const autoFill = getBatchAutoFill(batches);
    patchRow(index, autoFill);
  };

  const handleBatchChange = (index, itemName, value) => {
    const autoFill = getBatchAutoFill(batchOptionsByItem[itemName] || [], value);
    patchRow(index, { batch_no: value, vendor: autoFill.vendor, grade: autoFill.grade });
  };

  const addRow = () => setRows((prev) => [...prev, emptyMaterialRow()]);
  const removeRow = (index) => setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const openSubstitute = (index) => {
    setSubstitutingIndex(index);
    setSubstituteForm(emptySubstituteForm(rows[index]));
  };

  const closeSubstitute = () => {
    setSubstitutingIndex(null);
    setSubstituteForm(emptySubstituteForm());
  };

  const setSubstituteField = (key, value) => setSubstituteForm((prev) => ({ ...prev, [key]: value }));

  const handleSubstituteItemChange = async (value) => {
    setSubstituteForm((prev) => ({
      ...prev,
      substitute_item_id: value,
      substitute_batch_no: "",
      substitute_vendor: "",
      substitute_grade: ""
    }));
    const batches = await ensureBatchOptions(value);
    const autoFill = getBatchAutoFill(batches);
    setSubstituteForm((prev) => ({
      ...prev,
      substitute_batch_no: autoFill.batch_no,
      substitute_vendor: autoFill.vendor,
      substitute_grade: autoFill.grade
    }));
  };

  const handleSubstituteBatchChange = (itemName, value) => {
    const autoFill = getBatchAutoFill(batchOptionsByItem[itemName] || [], value);
    setSubstituteForm((prev) => ({
      ...prev,
      substitute_batch_no: value,
      substitute_vendor: autoFill.vendor,
      substitute_grade: autoFill.grade
    }));
  };

  const submitSubstitute = async (event) => {
    event.preventDefault();
    if (!record || substitutingIndex === null || submittingSubstitution) return;
    const row = rows[substitutingIndex];
    setSubmittingSubstitution(true);
    try {
      await api.post(`/production/${record.id}/substitute-batch`, {
        section,
        row_index: substitutingIndex,
        original_item_id: row.name,
        original_batch_no: row.batch_no,
        quantity: Math.round(Number(row.qty)),
        substitute_item_id: substituteForm.substitute_item_id,
        substitute_batch_no: substituteForm.substitute_batch_no,
        substitute_vendor: substituteForm.substitute_vendor || undefined,
        substitute_grade: substituteForm.substitute_grade || undefined,
        reason: substituteForm.reason || undefined
      });
      dispatchUserMessage("Batch substituted — inventory updated in real time.", { title: "Substituted", variant: "success" });
      closeSubstitute();
      await reload(false);
    } catch (error) {
      logApiError(error, "Failed to substitute batch");
    } finally {
      setSubmittingSubstitution(false);
    }
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || saving) return;
    setSaving(true);
    try {
      const payload = buildSectionPatchPayload(record, section, rows);
      await api.put(`/production/${record.id}/edit`, payload);
      dispatchUserMessage(`${label} saved.`, { title: "Saved", variant: "success" });
      await reload(false);
    } catch (error) {
      logApiError(error, `Failed to save ${label.toLowerCase()}`);
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
      <ProductionStepNav record={record} activeStep={stepKey} />

      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {label}
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
                <th>{colLabel}</th>
                <th>Supplier</th>
                <th>Grade</th>
                <th>Batch No.</th>
                <th>Qty (kg)</th>
                <th>Shift</th>
                <th>Remark</th>
                {canManageProduction && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td data-label="#" style={{ color: "#94a3b8", fontSize: 12 }}>{index + 1}</td>
                  {canManageProduction ? (
                    <>
                      <td data-label={colLabel}>
                        <SearchableSelect
                          options={materialOptions}
                          value={row.name}
                          onChange={(value) => { handleItemChange(index, value); }}
                          placeholder={colLabel}
                          allowCustom
                        />
                      </td>
                      <td data-label="Supplier">
                        <SearchableSelect
                          options={supplierOptions}
                          value={row.vendor}
                          onChange={(value) => setRowField(index, "vendor", value)}
                          placeholder="Supplier"
                          allowCustom
                        />
                      </td>
                      <td data-label="Grade"><input className="mfg-cell-input" autoComplete="off" value={row.grade} placeholder="Grade" onChange={(e) => setRowField(index, "grade", e.target.value)} /></td>
                      <td data-label="Batch No.">
                        <SearchableSelect
                          options={(batchOptionsByItem[row.name] || []).map((b) => ({
                            value: b.batchNo,
                            label: `${b.batchNo}${b.vendor ? ` — ${b.vendor}` : ""} (${b.availableQty} avail)`,
                            searchText: [b.batchNo, b.vendor, b.grade].filter(Boolean).join(" ")
                          }))}
                          value={row.batch_no}
                          onChange={(value) => { handleBatchChange(index, row.name, value); }}
                          placeholder="Batch"
                          allowCustom
                        />
                      </td>
                      <td data-label="Qty (kg)"><input autoComplete="off" className="mfg-cell-input mfg-cell-qty" type="number" min="0" step="0.1" value={row.qty} placeholder="0" onChange={(e) => setRowField(index, "qty", e.target.value)} /></td>
                      <td data-label="Shift">
                        <SearchableSelect
                          options={[{ value: "A", label: "A-Shift" }, { value: "B", label: "B-Shift" }, { value: "C", label: "C-Shift" }]}
                          value={row.shift}
                          onChange={(value) => setRowField(index, "shift", value)}
                          placeholder="Shift"
                        />
                      </td>
                      <td data-label="Remark"><input className="mfg-cell-input" autoComplete="off" value={row.remark} placeholder="Remark" onChange={(e) => setRowField(index, "remark", e.target.value)} /></td>
                      <td data-label="" style={{ display: "flex", gap: 6 }}>
                        {row.name && row.batch_no && Number(row.qty) > 0 && (
                          <button type="button" className="order-btn-secondary" style={{ padding: "2px 8px", whiteSpace: "nowrap" }} onClick={() => openSubstitute(index)}>
                            Substitute Batch
                          </button>
                        )}
                        {rows.length > 1 && (
                          <button type="button" className="order-btn-secondary" style={{ padding: "2px 8px" }} onClick={() => removeRow(index)}>×</button>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td data-label={colLabel}>{row.name || "-"}</td>
                      <td data-label="Supplier">{row.vendor || "-"}</td>
                      <td data-label="Grade">{row.grade || "-"}</td>
                      <td data-label="Batch No.">{row.batch_no || "-"}</td>
                      <td data-label="Qty (kg)">{row.qty || "-"}</td>
                      <td data-label="Shift">{row.shift ? `${row.shift}-Shift` : "-"}</td>
                      <td data-label="Remark">{row.remark || "-"}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {canManageProduction && (
          <button className="order-btn-primary" style={{ marginTop: 16 }} disabled={saving} onClick={onSubmit}>
            {saving ? "Saving..." : `Save ${label}`}
          </button>
        )}
      </section>

      {(record.batchSubstitutions || []).filter((s) => s.section === section).length > 0 && (
        <section className="order-card">
          <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Batch Substitution History
          </h3>
          <div className="order-table-wrap">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Original</th>
                  <th>Substitute</th>
                  <th>Qty</th>
                  <th>Reason</th>
                  <th>By</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {record.batchSubstitutions.filter((s) => s.section === section).map((s) => (
                  <tr key={s.id}>
                    <td>{s.originalItemId} / {s.originalBatchNo}</td>
                    <td>{s.substituteItemId} / {s.substituteBatchNo}</td>
                    <td>{s.quantity}</td>
                    <td>{s.reason || "-"}</td>
                    <td>{s.createdBy?.name || "-"}</td>
                    <td>{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {substitutingIndex !== null && (
        <div className="mfg-overlay">
          <div className="mfg-modal" style={{ maxWidth: 480 }}>
            <div className="mfg-header">
              <div className="mfg-header-left">
                <span className="mfg-badge">Substitute Batch</span>
                <h3 className="mfg-title">
                  {rows[substitutingIndex]?.name} — Batch {rows[substitutingIndex]?.batch_no}
                </h3>
                <p className="mfg-subtitle">
                  {rows[substitutingIndex]?.qty} kg will be returned to this batch and deducted from the substitute instead.
                </p>
              </div>
              <button className="mfg-close-btn" onClick={closeSubstitute} disabled={submittingSubstitution} aria-label="Close">
                &#10005;
              </button>
            </div>

            <form className="mfg-form" onSubmit={submitSubstitute}>
              <div className="order-form-grid">
                <div>
                  <label>Substitute Item *</label>
                  <SearchableSelect
                    options={materialOptions}
                    value={substituteForm.substitute_item_id}
                    onChange={(value) => { handleSubstituteItemChange(value); }}
                    placeholder={colLabel}
                    allowCustom
                  />
                </div>
                <div>
                  <label>Substitute Batch No. *</label>
                  <SearchableSelect
                    options={(batchOptionsByItem[substituteForm.substitute_item_id] || []).map((b) => ({
                      value: b.batchNo,
                      label: `${b.batchNo}${b.vendor ? ` — ${b.vendor}` : ""} (${b.availableQty} avail)`,
                      searchText: [b.batchNo, b.vendor, b.grade].filter(Boolean).join(" ")
                    }))}
                    value={substituteForm.substitute_batch_no}
                    onChange={(value) => { handleSubstituteBatchChange(substituteForm.substitute_item_id, value); }}
                    placeholder="Batch"
                    allowCustom
                  />
                </div>
                <div>
                  <label>Supplier</label>
                  <SearchableSelect
                    options={supplierOptions}
                    value={substituteForm.substitute_vendor}
                    onChange={(value) => setSubstituteField("substitute_vendor", value)}
                    placeholder="Supplier"
                    allowCustom
                  />
                </div>
                <div>
                  <label>Grade</label>
                  <input autoComplete="off" className="input" value={substituteForm.substitute_grade} onChange={(e) => setSubstituteField("substitute_grade", e.target.value)} />
                </div>
                <div className="full-row">
                  <label>Reason</label>
                  <textarea className="input" rows={2} value={substituteForm.reason} onChange={(e) => setSubstituteField("reason", e.target.value)} placeholder="e.g. Batch-1 urgently required for another production" />
                </div>
              </div>

              <div className="mfg-footer">
                <button type="button" className="mfg-btn-cancel" onClick={closeSubstitute} disabled={submittingSubstitution}>
                  Cancel
                </button>
                <button type="submit" className="mfg-btn-submit" disabled={submittingSubstitution}>
                  {submittingSubstitution ? "Substituting..." : "Substitute Batch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionMaterialStepPage;
