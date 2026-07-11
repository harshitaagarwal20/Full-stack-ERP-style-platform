import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { getDisplaySalesNumber } from "../utils/businessNumbers";

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function getStatusLabel(status) {
  if (status === "PENDING") return "Not Started";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "HOLD") return "Hold";
  if (status === "COMPLETED") return "Completed";
  return status || "-";
}

function getStatusClass(status) {
  if (status === "PENDING") return "created";
  if (status === "IN_PROGRESS") return "in-production";
  if (status === "HOLD") return "partial";
  if (status === "COMPLETED") return "dispatched";
  return "created";
}

function parseMfgData(rawMaterials) {
  try {
    const parsed = JSON.parse(rawMaterials || "{}");
    return {
      rm:            Array.isArray(parsed.rm)            ? parsed.rm            : [],
      additives:     Array.isArray(parsed.additives)     ? parsed.additives     : [],
      catalysts:     Array.isArray(parsed.catalysts)     ? parsed.catalysts     : [],
      pulveriserRpm: parsed.pulveriserRpm || "",
      equipment:     Array.isArray(parsed.equipment)     ? parsed.equipment     : [],
      processParams: Array.isArray(parsed.processParams) ? parsed.processParams : [],
      batchLogs:     Array.isArray(parsed.batchLogs)     ? parsed.batchLogs     : []
    };
  } catch {
    return { rm: [], additives: [], catalysts: [], pulveriserRpm: "", equipment: [], processParams: [], batchLogs: [] };
  }
}

function emptyMaterialRow() {
  return { name: "", vendor: "", grade: "", batch_no: "", qty: "", remark: "" };
}

function emptyEquipRow() {
  return { name: "", equipId: "", capacity: "" };
}

function emptyParamRow() {
  return { parameter: "", range: "", doneBy: "", reviewedBy: "", remark: "" };
}

function cloneMaterialRow(row = {}) {
  return {
    name: row.name || "",
    vendor: row.vendor || "",
    grade: row.grade || "",
    batch_no: row.batch_no || "",
    qty: row.qty || "",
    remark: row.remark || ""
  };
}

function cloneEquipRow(row = {}) {
  return {
    name: row.name || "",
    equipId: row.equipId || "",
    capacity: row.capacity || ""
  };
}

function cloneParamRow(row = {}) {
  return {
    parameter: row.parameter || "",
    range: row.range || "",
    doneBy: row.doneBy || "",
    reviewedBy: row.reviewedBy || "",
    remark: row.remark || ""
  };
}

function defaultEquipment() {
  return [
    { name: "Stainless Steel Reactor", equipId: "", capacity: "" },
    { name: "Screw Conveyor No", equipId: "", capacity: "" },
    { name: "Grinding Mill, No", equipId: "", capacity: "" },
    { name: "Classifier No", equipId: "", capacity: "" },
    { name: "Dust Collector No", equipId: "", capacity: "" },
    { name: "Storage Silo", equipId: "", capacity: "" }
  ];
}

function defaultProcessParams() {
  return [
    { parameter: "Initial Temperature", range: "70 to 120 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Reaction Temperature", range: "80 to 100 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Chopper Temperature", range: "85 to 100 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Completion Temperature", range: "80 to 120 C", doneBy: "", reviewedBy: "", remark: "" }
  ];
}

function ensureRows(rows, factory) {
  return rows.length ? rows : [factory()];
}

function buildMfgEditState(record) {
  const mfg = parseMfgData(record?.rawMaterials);
  return {
    batch_no: record?.batchNo || "",
    particle_size: record?.particleSize || "Fine",
    acm_rpm: record?.acmRpm ? String(record.acmRpm) : "",
    classifier_rpm: mfg.pulveriserRpm || (record?.classifierRpm ? String(record.classifierRpm) : ""),
    blower_rpm: record?.blowerRpm ? String(record.blowerRpm) : "",
    rm: ensureRows(mfg.rm.map(cloneMaterialRow), emptyMaterialRow),
    additives: ensureRows(mfg.additives.map(cloneMaterialRow), emptyMaterialRow),
    catalysts: ensureRows(mfg.catalysts.map(cloneMaterialRow), emptyMaterialRow),
    remarks: record?.remarks || ""
  };
}

function buildPfrEditState(record) {
  const mfg = parseMfgData(record?.rawMaterials);
  return {
    equipment: mfg.equipment.length ? mfg.equipment.map(cloneEquipRow) : defaultEquipment(),
    processParams: mfg.processParams.length ? mfg.processParams.map(cloneParamRow) : defaultProcessParams()
  };
}

function SectionTitle({ children }) {
  return (
    <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {children}
    </h3>
  );
}

function EmptyNote({ children }) {
  return <p style={{ color: "#94a3b8", fontSize: "13px", margin: "8px 0" }}>{children}</p>;
}

function MaterialTable({ rows, colLabel }) {
  if (!rows.length) return <EmptyNote>No entries recorded.</EmptyNote>;
  return (
    <div className="responsive-table-wrap" style={{ marginTop: 0 }}>
      <table className="order-table responsive-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{colLabel}</th>
            <th>Supplier</th>
            <th>Grade</th>
            <th>Batch No.</th>
            <th>Qty (kg)</th>
            <th>Remark</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td data-label="">{i + 1}</td>
              <td data-label={colLabel}>{row.name || "-"}</td>
              <td data-label="Supplier">{row.vendor || "-"}</td>
              <td data-label="Grade">{row.grade || "-"}</td>
              <td data-label="Batch No.">{row.batch_no || "-"}</td>
              <td data-label="Qty (kg)">{row.qty || "-"}</td>
              <td data-label="Remark">{row.remark || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = [
  { key: "overview",   label: "Overview" },
  { key: "rm",        label: "Raw Materials" },
  { key: "additives", label: "Additives" },
  { key: "catalysts", label: "Catalyst" },
  { key: "equipment", label: "Equipment" },
  { key: "params",    label: "Process Params" },
  { key: "oplog",     label: "Operation Log" }
];

function TabBar({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: "2px", borderBottom: "2px solid #e2e8f0", marginBottom: "20px", flexWrap: "wrap" }}>
      {TABS.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: active === tab.key ? "700" : "400",
            color: active === tab.key ? "#1e293b" : "#64748b",
            borderBottom: active === tab.key ? "2px solid #1e293b" : "2px solid transparent",
            marginBottom: "-2px",
            whiteSpace: "nowrap"
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ProductionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isMfgEditOpen, setIsMfgEditOpen] = useState(false);
  const [savingMfg, setSavingMfg] = useState(false);
  const [mfgEditForm, setMfgEditForm] = useState(null);
  const [pfrEditForm, setPfrEditForm] = useState(null);
  const canManageProduction = ["admin", "production"].includes(user?.role);

  const loadRecord = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { data } = await api.get(`/production/${id}`);
      setRecord(data);
      return data;
    } catch (err) {
      logApiError(err, "Failed to load production record");
      if (showLoading) {
        navigate("/production");
      }
      return null;
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadRecord();
  }, [id]);

  const mfg = useMemo(() => (record ? parseMfgData(record.rawMaterials) : null), [record]);
  const operationMaterialNames = useMemo(() => {
    const rmNames = Array.isArray(mfg?.rm) ? mfg.rm.map((row) => row.name).filter(Boolean) : [];
    return [rmNames[0] || "Material 1", rmNames[1] || "Material 2"];
  }, [mfg]);

  const openMfgEdit = () => {
    if (!record || !canManageProduction) return;
    setMfgEditForm(buildMfgEditState(record));
    setPfrEditForm(buildPfrEditState(record));
    setIsMfgEditOpen(true);
  };

  const closeMfgEdit = () => {
    setIsMfgEditOpen(false);
    setMfgEditForm(null);
    setPfrEditForm(null);
  };

  const setMfgEditField = (key, value) => {
    setMfgEditForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const setMfgEditMaterialRow = (section, index, key, value) => {
    setMfgEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [section]: prev[section].map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
      };
    });
  };

  const addMfgEditMaterialRow = (section) => {
    setMfgEditForm((prev) => (prev ? { ...prev, [section]: [...prev[section], emptyMaterialRow()] } : prev));
  };

  const removeMfgEditMaterialRow = (section, index) => {
    setMfgEditForm((prev) => {
      if (!prev || prev[section].length <= 1) return prev;
      return { ...prev, [section]: prev[section].filter((_, rowIndex) => rowIndex !== index) };
    });
  };

  const setPfrEditRow = (index, key, value) => {
    setPfrEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        equipment: prev.equipment.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
      };
    });
  };

  const addPfrEquipRow = () => {
    setPfrEditForm((prev) => (prev ? { ...prev, equipment: [...prev.equipment, emptyEquipRow()] } : prev));
  };

  const removePfrEquipRow = (index) => {
    setPfrEditForm((prev) => {
      if (!prev || prev.equipment.length <= 1) return prev;
      return { ...prev, equipment: prev.equipment.filter((_, rowIndex) => rowIndex !== index) };
    });
  };

  const setPfrParamRow = (index, key, value) => {
    setPfrEditForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        processParams: prev.processParams.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row))
      };
    });
  };

  const addPfrParamRow = () => {
    setPfrEditForm((prev) => (prev ? { ...prev, processParams: [...prev.processParams, emptyParamRow()] } : prev));
  };

  const removePfrParamRow = (index) => {
    setPfrEditForm((prev) => {
      if (!prev || prev.processParams.length <= 1) return prev;
      return { ...prev, processParams: prev.processParams.filter((_, rowIndex) => rowIndex !== index) };
    });
  };

  const submitMfgEdit = async (event) => {
    event.preventDefault();
    if (!record || !canManageProduction || !mfgEditForm || !pfrEditForm || savingMfg) return;

    setSavingMfg(true);
    try {
      const rawMaterialsJson = JSON.stringify({
        rm: mfgEditForm.rm,
        additives: mfgEditForm.additives,
        catalysts: mfgEditForm.catalysts,
        pulveriserRpm: mfgEditForm.classifier_rpm,
        equipment: pfrEditForm.equipment,
        processParams: pfrEditForm.processParams
      });

      await api.put(`/production/${record.id}/edit`, {
        status: record.status === "PENDING" ? "IN_PROGRESS" : record.status,
        batch_no: mfgEditForm.batch_no || undefined,
        particle_size: mfgEditForm.particle_size || undefined,
        acm_rpm: mfgEditForm.acm_rpm ? Number(mfgEditForm.acm_rpm) : undefined,
        classifier_rpm: mfgEditForm.classifier_rpm ? Number(mfgEditForm.classifier_rpm) : undefined,
        blower_rpm: mfgEditForm.blower_rpm ? Number(mfgEditForm.blower_rpm) : undefined,
        raw_materials: rawMaterialsJson,
        remarks: mfgEditForm.remarks || undefined
      });

      closeMfgEdit();
      await loadRecord(false);
    } catch (error) {
      logApiError(error, "Failed to save production details");
    } finally {
      setSavingMfg(false);
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

  const order = record.order || {};
  const hasMfgData = Boolean(record.batchNo);

  return (
    <div className="order-page">

      {/* ── Header ── */}
      <section className="order-card po-detail-header">
        <div className="po-detail-header-top">
          <button className="order-btn-secondary" onClick={() => navigate("/production")}>
            ← Production
          </button>
          <div className="po-detail-header-meta">
            <div className="po-detail-title-block">
              <div className="po-detail-number">{order.orderNo || `#${record.id}`}</div>
              <div className="po-detail-supplier-name">
                {order.clientName || "-"}
                {record.batchNo && <span style={{ marginLeft: 10, color: "#64748b", fontWeight: 400, fontSize: 13 }}>Batch: {record.batchNo}</span>}
              </div>
            </div>
            {canManageProduction && (
              <button className="order-btn-secondary" onClick={openMfgEdit}>
                Edit MFG Details
              </button>
            )}
            <span className={`order-status ${getStatusClass(record.status)}`}>
              {getStatusLabel(record.status)}
            </span>
          </div>
        </div>
      </section>

      {/* ── Tab card ── */}
      <section className="order-card">
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Overview */}
        {activeTab === "overview" && (
          <div>
            <div className="po-detail-info-grid" style={{ marginBottom: 0 }}>
              {/* Order info */}
              <div>
                <SectionTitle>Order Details</SectionTitle>
                <div className="order-detail-grid">
                  <p><span>Order No</span> {order.orderNo || "-"}</p>
                  <p><span>Sales ID</span> {getDisplaySalesNumber(order) || "-"}</p>
                  <p><span>Product</span> {order.product || order.enquiry?.product || "-"}</p>
                  <p><span>Grade</span> {order.grade || "-"}</p>
                  <p><span>Quantity</span> {order.quantity || "-"} {order.unit || ""}</p>
                  <p><span>Packing Type</span> {order.packingType || "-"}</p>
                  <p><span>Packing Size</span> {order.packingSize || "-"}</p>
                  <p><span>Client</span> {order.clientName || "-"}</p>
                  <p><span>City</span> {order.city || "-"}</p>
                  <p><span>State</span> {order.state || "-"}</p>
                  <p><span>Delivery Date</span> {formatDate(order.deliveryDate)}</p>
                </div>
              </div>

              {/* Production info */}
              <div>
                <SectionTitle>Production Details</SectionTitle>
                <div className="order-detail-grid">
                  <p><span>Status</span> {getStatusLabel(record.status)}</p>
                  <p><span>Production State</span> {record.state || "-"}</p>
                  <p><span>Expected Delivery</span> {formatDate(record.deliveryDate)}</p>
                  <p><span>Completion Date</span> {formatDate(record.productionCompletionDate)}</p>
                  <p><span>Assigned To</span> {record.assignedPersonnel || "-"}</p>
                  <p><span>Capacity</span> {record.capacity || "-"}</p>
                  {record.batchNo && <p><span>Batch No</span> <strong>{record.batchNo}</strong></p>}
                  {record.particleSize && <p><span>Particle Size</span> {record.particleSize}</p>}
                  {record.acmRpm     && <p><span>ACM-RPM</span> {record.acmRpm}</p>}
                  {mfg?.pulveriserRpm && <p><span>Pulveriser-RPM</span> {mfg.pulveriserRpm}</p>}
                  {record.blowerRpm  && <p><span>Blower-RPM</span> {record.blowerRpm}</p>}
                  {record.remarks    && <p style={{ gridColumn: "1 / -1" }}><span>Remarks</span> {record.remarks}</p>}
                </div>
              </div>
            </div>

            {!hasMfgData && (
              <div style={{ marginTop: 20, padding: "16px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <p style={{ margin: 0, color: "#64748b", fontSize: 13 }}>
                  Manufacturing order not started yet. Use "Start Production" from the Production list to fill in batch, materials and equipment details.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Raw Materials */}
        {activeTab === "rm" && (
          <div>
            <SectionTitle>Approved Raw Materials</SectionTitle>
            <MaterialTable rows={mfg?.rm || []} colLabel="RM Name" />
          </div>
        )}

        {/* Additives */}
        {activeTab === "additives" && (
          <div>
            <SectionTitle>Additives</SectionTitle>
            <MaterialTable rows={mfg?.additives || []} colLabel="Additive" />
          </div>
        )}

        {/* Catalyst */}
        {activeTab === "catalysts" && (
          <div>
            <SectionTitle>Catalyst</SectionTitle>
            <MaterialTable rows={mfg?.catalysts || []} colLabel="Catalyst" />
          </div>
        )}

        {/* Equipment */}
        {activeTab === "equipment" && (
          <div>
            <SectionTitle>Equipment Used in Production Line</SectionTitle>
            {mfg?.equipment.length ? (
              <div className="responsive-table-wrap" style={{ marginTop: 0 }}>
                <table className="order-table responsive-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Equipment Name</th>
                      <th>Equipment ID No.</th>
                      <th>Capacity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfg.equipment.map((row, i) => (
                      <tr key={i}>
                        <td data-label="">{i + 1}</td>
                        <td data-label="Equipment Name">{row.name || "-"}</td>
                        <td data-label="Equipment ID No.">{row.equipId || "-"}</td>
                        <td data-label="Capacity">{row.capacity || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyNote>No equipment entries recorded.</EmptyNote>}
          </div>
        )}

        {/* Process Params */}
        {activeTab === "params" && (
          <div>
            <SectionTitle>Critical Process Parameters</SectionTitle>
            {mfg?.processParams.length ? (
              <div className="responsive-table-wrap" style={{ marginTop: 0 }}>
                <table className="order-table responsive-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Parameter</th>
                      <th>Range</th>
                      <th>Done By</th>
                      <th>Reviewed By</th>
                      <th>Remark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfg.processParams.map((row, i) => (
                      <tr key={i}>
                        <td data-label="">{i + 1}</td>
                        <td data-label="Parameter">{row.parameter || "-"}</td>
                        <td data-label="Range">{row.range || "-"}</td>
                        <td data-label="Done By">{row.doneBy || "-"}</td>
                        <td data-label="Reviewed By">{row.reviewedBy || "-"}</td>
                        <td data-label="Remark">{row.remark || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyNote>No process parameters recorded.</EmptyNote>}
          </div>
        )}

        {/* Operation Log */}
        {activeTab === "oplog" && (
          <div>
            <SectionTitle>Manufacturing Operation Log — Lot-wise Batch Record</SectionTitle>
            {mfg?.batchLogs.length ? (
              <div className="responsive-table-wrap" style={{ marginTop: 0 }}>
                <table className="order-table responsive-table">
                  <thead>
                    <tr>
                      <th>Lot No.</th>
                      <th>Date</th>
                      <th>{operationMaterialNames[0]} (kg)</th>
                      <th>{operationMaterialNames[1]} (kg)</th>
                      <th>Initial Temp</th>
                      <th>Reaction Temp</th>
                      <th>Chopper Temp</th>
                      <th>Completion Temp</th>
                      <th>Done By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mfg.batchLogs.map((row, i) => (
                      <tr key={i}>
                        <td data-label="Lot No.">{row.lotNo || i + 1}</td>
                        <td data-label="Date">{row.date || "-"}</td>
                        <td data-label={`${operationMaterialNames[0]} (kg)`}>{(row.material1Qty ?? row.stearicAcid) || "-"}</td>
                        <td data-label={`${operationMaterialNames[1]} (kg)`}>{(row.material2Qty ?? row.caOH2) || "-"}</td>
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
            ) : <EmptyNote>No operation log entries recorded.</EmptyNote>}
          </div>
        )}
      </section>

      {isMfgEditOpen && mfgEditForm && pfrEditForm && (
        <div className="mfg-overlay">
          <div className="mfg-modal">
            <div className="mfg-header">
              <div className="mfg-header-left">
                <span className="mfg-badge">Edit Manufacturing Details</span>
                <h3 className="mfg-title">{order.orderNo || `#${record.id}`}</h3>
                <p className="mfg-subtitle">
                  {order.clientName || "-"} &mdash; Batch: {mfgEditForm.batch_no || "—"}
                </p>
              </div>
              <button className="mfg-close-btn" onClick={closeMfgEdit} disabled={savingMfg} aria-label="Close">
                &#10005;
              </button>
            </div>

            <div className="mfg-summary">
              {[
                { label: "Product", value: order.product || order.enquiry?.product || "-" },
                { label: "Grade", value: order.grade || "-" },
                { label: "Quantity", value: `${order.quantity || "-"} ${order.unit || ""}`.trim() },
                { label: "Packing Type", value: order.packingType || "-" },
                { label: "Packing Size", value: order.packingSize || "-" },
                { label: "Current Status", value: getStatusLabel(record.status) }
              ].map(({ label, value }) => (
                <div key={label} className="mfg-summary-item">
                  <span className="mfg-summary-label">{label}</span>
                  <span className="mfg-summary-value">{value || "-"}</span>
                </div>
              ))}
            </div>

            <form className="mfg-form" onSubmit={submitMfgEdit}>
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">1</span>
                  <h4 className="mfg-section-title">Batch &amp; Machine Settings</h4>
                </div>
                <div className="mfg-settings-grid">
                  <div className="mfg-field">
                    <label className="mfg-label">Batch No. <span className="mfg-required">*</span></label>
                    <input className="mfg-input" value={mfgEditForm.batch_no} onChange={(e) => setMfgEditField("batch_no", e.target.value)} required />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Particle Size</label>
                    <input className="mfg-input" value={mfgEditForm.particle_size} onChange={(e) => setMfgEditField("particle_size", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">ACM-RPM</label>
                    <input className="mfg-input" type="number" min="1" value={mfgEditForm.acm_rpm} onChange={(e) => setMfgEditField("acm_rpm", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Pulveriser-RPM</label>
                    <input className="mfg-input" type="number" min="1" value={mfgEditForm.classifier_rpm} onChange={(e) => setMfgEditField("classifier_rpm", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Blower-RPM</label>
                    <input className="mfg-input" type="number" min="1" value={mfgEditForm.blower_rpm} onChange={(e) => setMfgEditField("blower_rpm", e.target.value)} />
                  </div>
                </div>
              </div>

              {[
                { key: "rm", num: "2", label: "Approved Raw Materials", colLabel: "RM Name" },
                { key: "additives", num: "3", label: "Additives", colLabel: "Additive" },
                { key: "catalysts", num: "4", label: "Catalyst", colLabel: "Catalyst" }
              ].map(({ key, num, label, colLabel }) => (
                <div key={key} className="mfg-section">
                  <div className="mfg-section-header">
                    <span className="mfg-section-num">{num}</span>
                    <h4 className="mfg-section-title">{label}</h4>
                    <button type="button" className="mfg-add-btn" onClick={() => addMfgEditMaterialRow(key)}>
                      + Add Row
                    </button>
                  </div>
                  <div className="mfg-table-wrap">
                    <table className="mfg-table">
                      <thead>
                        <tr>
                          <th>{colLabel}</th>
                          <th>Supplier Name</th>
                          <th>Grade</th>
                          <th>Batch No.</th>
                          <th>Qty (kg)</th>
                          <th>Remark</th>
                          <th className="mfg-th-del" />
                        </tr>
                      </thead>
                      <tbody>
                        {mfgEditForm[key].map((row, index) => (
                          <tr key={`${key}-${index}`}>
                            <td><input className="mfg-cell-input" value={row.name} placeholder={colLabel} onChange={(e) => setMfgEditMaterialRow(key, index, "name", e.target.value)} /></td>
                            <td><input className="mfg-cell-input" value={row.vendor} placeholder="Supplier" onChange={(e) => setMfgEditMaterialRow(key, index, "vendor", e.target.value)} /></td>
                            <td><input className="mfg-cell-input" value={row.grade} placeholder="Grade" onChange={(e) => setMfgEditMaterialRow(key, index, "grade", e.target.value)} /></td>
                            <td><input className="mfg-cell-input" value={row.batch_no} placeholder="Batch" onChange={(e) => setMfgEditMaterialRow(key, index, "batch_no", e.target.value)} /></td>
                            <td><input className="mfg-cell-input mfg-cell-qty" type="number" min="0" step="0.1" value={row.qty} placeholder="0" onChange={(e) => setMfgEditMaterialRow(key, index, "qty", e.target.value)} /></td>
                            <td><input className="mfg-cell-input" value={row.remark} placeholder="Remark" onChange={(e) => setMfgEditMaterialRow(key, index, "remark", e.target.value)} /></td>
                            <td className="mfg-td-del">
                              {mfgEditForm[key].length > 1 && (
                                <button type="button" className="mfg-del-btn" onClick={() => removeMfgEditMaterialRow(key, index)} aria-label="Remove">
                                  &#10005;
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">5</span>
                  <h4 className="mfg-section-title">Equipment Used in Production Line</h4>
                  <button type="button" className="mfg-add-btn" onClick={addPfrEquipRow}>+ Add Row</button>
                </div>
                <div className="mfg-table-wrap">
                  <table className="mfg-table">
                    <thead>
                      <tr>
                        <th>Equipment Name</th>
                        <th>Equipment ID No.</th>
                        <th>Capacity</th>
                        <th className="mfg-th-del" />
                      </tr>
                    </thead>
                    <tbody>
                      {pfrEditForm.equipment.map((row, index) => (
                        <tr key={`equip-${index}`}>
                          <td><input className="mfg-cell-input" value={row.name} onChange={(e) => setPfrEditRow(index, "name", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.equipId} onChange={(e) => setPfrEditRow(index, "equipId", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.capacity} onChange={(e) => setPfrEditRow(index, "capacity", e.target.value)} /></td>
                          <td className="mfg-td-del">
                            {pfrEditForm.equipment.length > 1 && (
                              <button type="button" className="mfg-del-btn" onClick={() => removePfrEquipRow(index)} aria-label="Remove">
                                &#10005;
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">6</span>
                  <h4 className="mfg-section-title">Critical Process Parameters</h4>
                  <button type="button" className="mfg-add-btn" onClick={addPfrParamRow}>+ Add Row</button>
                </div>
                <div className="mfg-table-wrap">
                  <table className="mfg-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Range</th>
                        <th>Done By</th>
                        <th>Reviewed By</th>
                        <th>Remark</th>
                        <th className="mfg-th-del" />
                      </tr>
                    </thead>
                    <tbody>
                      {pfrEditForm.processParams.map((row, index) => (
                        <tr key={`param-${index}`}>
                          <td><input className="mfg-cell-input" value={row.parameter} onChange={(e) => setPfrParamRow(index, "parameter", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.range} onChange={(e) => setPfrParamRow(index, "range", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.doneBy} onChange={(e) => setPfrParamRow(index, "doneBy", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.reviewedBy} onChange={(e) => setPfrParamRow(index, "reviewedBy", e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.remark} onChange={(e) => setPfrParamRow(index, "remark", e.target.value)} /></td>
                          <td className="mfg-td-del">
                            {pfrEditForm.processParams.length > 1 && (
                              <button type="button" className="mfg-del-btn" onClick={() => removePfrParamRow(index)} aria-label="Remove">
                                &#10005;
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">7</span>
                  <h4 className="mfg-section-title">Remarks / Order By</h4>
                </div>
                <textarea
                  className="mfg-input mfg-textarea"
                  rows={3}
                  value={mfgEditForm.remarks}
                  onChange={(e) => setMfgEditField("remarks", e.target.value)}
                  placeholder="Additional instructions..."
                />
              </div>

              <div className="mfg-footer">
                <button type="button" className="mfg-btn-cancel" onClick={closeMfgEdit} disabled={savingMfg}>
                  Cancel
                </button>
                <button type="submit" className="mfg-btn-submit" disabled={savingMfg}>
                  {savingMfg ? "Saving..." : "Save MFG Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionDetailPage;
