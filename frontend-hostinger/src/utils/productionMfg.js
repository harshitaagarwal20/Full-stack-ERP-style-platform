export function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Human-readable elapsed time between when a batch started (IN_PROGRESS)
// and completed, e.g. "2d 4h" or "45m". Returns "-" if either end is missing.
export function formatDuration(startedAt, completedAt) {
  if (!startedAt || !completedAt) return "-";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "-";

  const totalMinutes = Math.round((end - start) / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (!days && minutes) parts.push(`${minutes}m`);
  return parts.length ? parts.join(" ") : "0m";
}

export function getStatusLabel(status) {
  if (status === "PENDING") return "Not Started";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "PARTIALLY_PRODUCED") return "Partially Produced";
  if (status === "HOLD") return "Hold";
  if (status === "REWORK") return "Rework";
  if (status === "COMPLETED") return "Completed";
  return status || "-";
}

export function getStatusClass(status) {
  if (status === "PENDING") return "created";
  if (status === "IN_PROGRESS") return "in-production";
  if (status === "PARTIALLY_PRODUCED") return "partial";
  if (status === "HOLD") return "partial";
  if (status === "REWORK") return "rework";
  if (status === "COMPLETED") return "dispatched";
  return "created";
}

// The machine-speed fields can be recorded either as RPM (fixed-speed drives)
// or Hz (VFD/frequency-driven machines). The unit is stored per machine in the
// mfg blob so no schema change is needed; RPM stays the default for older
// records that never carried a unit.
export const SPEED_UNITS = ["RPM", "Hz"];

function normalizeSpeedUnit(value) {
  return SPEED_UNITS.includes(value) ? value : "RPM";
}

// "1500 RPM" / "50 Hz" — blank when there is no value to qualify.
export function formatSpeed(value, unit) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return `${text} ${normalizeSpeedUnit(unit)}`;
}

export function parseMfgData(rawMaterials) {
  try {
    const parsed = JSON.parse(rawMaterials || "{}");
    return {
      rm:            Array.isArray(parsed.rm)            ? parsed.rm            : [],
      additives:     Array.isArray(parsed.additives)     ? parsed.additives     : [],
      catalysts:     Array.isArray(parsed.catalysts)     ? parsed.catalysts     : [],
      pulveriserRpm: parsed.pulveriserRpm || "",
      acmRpmUnit:       normalizeSpeedUnit(parsed.acmRpmUnit),
      pulveriserRpmUnit: normalizeSpeedUnit(parsed.pulveriserRpmUnit),
      blowerRpmUnit:    normalizeSpeedUnit(parsed.blowerRpmUnit),
      equipment:     Array.isArray(parsed.equipment)     ? parsed.equipment     : [],
      processParams: Array.isArray(parsed.processParams) ? parsed.processParams : [],
      batchLogs:     Array.isArray(parsed.batchLogs)     ? parsed.batchLogs     : []
    };
  } catch {
    return { rm: [], additives: [], catalysts: [], pulveriserRpm: "", acmRpmUnit: "RPM", pulveriserRpmUnit: "RPM", blowerRpmUnit: "RPM", equipment: [], processParams: [], batchLogs: [] };
  }
}

export function ensureRows(rows, factory) {
  return rows.length ? rows : [factory()];
}

export function emptyMaterialRow() {
  return { name: "", vendor: "", grade: "", batch_no: "", qty: "", remark: "", shift: "" };
}

export function cloneMaterialRow(row = {}) {
  return {
    name: row.name || "",
    vendor: row.vendor || "",
    grade: row.grade || "",
    batch_no: row.batch_no || "",
    qty: row.qty || "",
    remark: row.remark || "",
    shift: row.shift || ""
  };
}

export function emptyEquipRow() {
  return { name: "", equipId: "", capacity: "" };
}

export function cloneEquipRow(row = {}) {
  return {
    name: row.name || "",
    equipId: row.equipId || "",
    capacity: row.capacity || ""
  };
}

export function emptyParamRow() {
  return { parameter: "", range: "", doneBy: "", reviewedBy: "", remark: "" };
}

export function cloneParamRow(row = {}) {
  return {
    parameter: row.parameter || "",
    range: row.range || "",
    doneBy: row.doneBy || "",
    reviewedBy: row.reviewedBy || "",
    remark: row.remark || ""
  };
}

export function emptyOperationLogRow() {
  return {
    lotNo: "", date: "", material1Qty: "", material2Qty: "",
    initialTemp: "", reactionTemp: "", chopperTemp: "", completionTemp: "", doneBy: ""
  };
}

export function cloneOperationLogRow(row = {}) {
  return {
    lotNo: row.lotNo || "",
    date: row.date || "",
    material1Qty: row.material1Qty ?? row.stearicAcid ?? "",
    material2Qty: row.material2Qty ?? row.caOH2 ?? "",
    initialTemp: row.initialTemp || "",
    reactionTemp: row.reactionTemp || "",
    chopperTemp: row.chopperTemp || "",
    completionTemp: row.completionTemp || "",
    doneBy: row.doneBy || ""
  };
}

export function getOperationMaterialNames(rawMaterials) {
  const mfg = typeof rawMaterials === "string" ? parseMfgData(rawMaterials) : rawMaterials;
  const rmNames = Array.isArray(mfg?.rm) ? mfg.rm.map((row) => row.name).filter(Boolean) : [];
  return [rmNames[0] || "Material 1", rmNames[1] || "Material 2"];
}

export function defaultProcessParams() {
  return [
    { parameter: "Initial Temperature", range: "70 to 120 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Reaction Temperature", range: "80 to 100 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Chopper Temperature", range: "85 to 100 C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Completion Temperature", range: "80 to 120 C", doneBy: "", reviewedBy: "", remark: "" }
  ];
}

// Builds the payload for PUT /production/:id/edit that patches only one
// section of the shared rawMaterials JSON blob, leaving every other
// section (and the batch/machine settings fields) exactly as they were.
export function buildSectionPatchPayload(record, sectionKey, sectionValue, extraFields = {}) {
  const mfg = parseMfgData(record?.rawMaterials);

  // sectionKey is normally a single blob key (with sectionValue), but may also
  // be an object of several blob overrides at once — in that form sectionValue
  // carries the extra top-level fields instead.
  const isMulti = sectionKey !== null && typeof sectionKey === "object";
  const overrides = isMulti ? sectionKey : { [sectionKey]: sectionValue };
  const extras = isMulti ? (sectionValue || {}) : extraFields;
  const merged = { ...mfg, ...overrides };

  return {
    status: record?.status === "PENDING" ? "IN_PROGRESS" : record?.status,
    raw_materials: JSON.stringify({
      rm: merged.rm,
      additives: merged.additives,
      catalysts: merged.catalysts,
      pulveriserRpm: merged.pulveriserRpm,
      acmRpmUnit: merged.acmRpmUnit,
      pulveriserRpmUnit: merged.pulveriserRpmUnit,
      blowerRpmUnit: merged.blowerRpmUnit,
      equipment: merged.equipment,
      processParams: merged.processParams,
      batchLogs: merged.batchLogs
    }),
    ...extras
  };
}
