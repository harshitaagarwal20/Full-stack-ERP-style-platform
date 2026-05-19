import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";

const MasterDataSupplierTable = lazy(() => import("../components/masterdata/MasterDataSupplierTable"));
const MasterDataSupplierModal = lazy(() => import("../components/masterdata/MasterDataSupplierModal"));

const SUPPLIER_FORM_INITIAL = {
  supplier_name: "",
  gstn: "",
  pan_no: "",
  country: "",
  address: "",
  pincode: "",
  state: "",
  city: ""
};

const COUNTRY_OPTIONS = [
  { value: "India", code: "IN" },
  { value: "United Arab Emirates", code: "AE" },
  { value: "United States", code: "US" }
];

const STATE_OPTIONS = {
  India: ["Maharashtra", "Gujarat", "Delhi", "Karnataka", "Tamil Nadu", "Rajasthan"],
  "United Arab Emirates": ["Dubai", "Abu Dhabi", "Sharjah"],
  "United States": ["California", "Texas", "New York", "Florida"]
};

const SUPPLIER_HEADER_MAP = {
  supplier: "supplier_name",
  suppliername: "supplier_name",
  name: "supplier_name",
  gstn: "gstn",
  gst: "gstn",
  gstnumber: "gstn",
  gstin: "gstn",
  pan: "pan_no",
  panno: "pan_no",
  pannumber: "pan_no",
  pancard: "pan_no",
  country: "country",
  countrycode: "country_code",
  suppliercode: "supplier_code",
  supplierid: "supplier_code",
  vendor: "supplier_name",
  vendorname: "supplier_name",
  vendorcode: "supplier_code",
  contactperson: "contact_person",
  contactpersonname: "contact_person",
  contactpersonnumber: "contact_person_number",
  contactnumber: "contact_person_number",
  phone: "contact_person_number",
  mobile: "contact_person_number",
  phonenumber: "contact_person_number",
  mobilenumber: "contact_person_number",
  email: "company_email",
  companyemail: "company_email",
  emailid: "company_email",
  address: "address",
  addr: "address",
  fulladdress: "address",
  pincode: "pincode",
  pin: "pincode",
  pinno: "pincode",
  zip: "pincode",
  zipcode: "pincode",
  state: "state",
  city: "city"
};

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeSupplierHeader(header) {
  return String(header || "")
    .replace(/^[﻿￾]+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveSupplierHeader(header) {
  const normalized = normalizeSupplierHeader(header);
  if (SUPPLIER_HEADER_MAP[normalized]) return SUPPLIER_HEADER_MAP[normalized];
  if (normalized.includes("supplier") && normalized.includes("name")) return "supplier_name";
  if (normalized.includes("vendor") && normalized.includes("name")) return "supplier_name";
  if (normalized === "name") return "supplier_name";
  if (normalized.includes("gst")) return "gstn";
  if (normalized.includes("pan")) return "pan_no";
  if (normalized.includes("country") && normalized.includes("code")) return "country_code";
  if (normalized === "country") return "country";
  if (normalized.includes("supplier") && normalized.includes("code")) return "supplier_code";
  if (normalized.includes("vendor") && normalized.includes("code")) return "supplier_code";
  if (normalized.includes("contact") && normalized.includes("person") && normalized.includes("number")) return "contact_person_number";
  if (normalized.includes("contact") && normalized.includes("person")) return "contact_person";
  if (normalized.includes("contact") && normalized.includes("no")) return "contact_person_number";
  if (normalized.includes("phone") || normalized.includes("mobile")) return "contact_person_number";
  if (normalized.includes("email")) return "company_email";
  if (normalized.includes("address")) return "address";
  if (normalized.includes("pin") || normalized.includes("zip")) return "pincode";
  if (normalized === "state") return "state";
  if (normalized === "city") return "city";
  return null;
}

function normalizeSupplierRowObject(sourceRow = {}) {
  const row = {};
  for (const [key, value] of Object.entries(sourceRow || {})) {
    const normalizedKey = resolveSupplierHeader(key);
    if (!normalizedKey) continue;
    row[normalizedKey] = String(value ?? "").trim();
  }
  return mapSupplierRow(row);
}

function scoreSupplierHeaderRow(row = []) {
  const resolved = row.map((item) => resolveSupplierHeader(item));
  const recognizedCount = resolved.filter(Boolean).length;
  const hasSupplierName = resolved.includes("supplier_name") ? 5 : 0;
  const hasLocationFields = ["country", "state", "city", "pincode"].reduce(
    (score, key) => score + (resolved.includes(key) ? 1 : 0),
    0
  );
  return {
    resolved,
    score: recognizedCount + hasSupplierName + hasLocationFields
  };
}

function mapSupplierRow(row) {
  return {
    supplier_name: row.supplier_name || "",
    gstn: row.gstn || "",
    pan_no: row.pan_no || "",
    country: row.country || "",
    address: row.address || "",
    pincode: row.pincode || "",
    state: row.state || "",
    city: row.city || ""
  };
}

function parseMatrixToSupplierRows(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) return [];

  const scanLimit = Math.min(matrix.length, 12);
  let bestHeaders = [];
  let bestScore = 0;
  let headerIndex = -1;

  for (let index = 0; index < scanLimit; index += 1) {
    const row = Array.isArray(matrix[index]) ? matrix[index] : [];
    const { resolved, score } = scoreSupplierHeaderRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestHeaders = resolved;
      headerIndex = index;
    }
  }

  if (headerIndex < 0 || bestScore < 2) return [];

  const rows = [];

  for (let i = headerIndex + 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    const row = {};

    for (let j = 0; j < bestHeaders.length; j += 1) {
      const key = bestHeaders[j];
      if (!key) continue;
      row[key] = String(line?.[j] || "").trim();
    }

    const hasRowValue = Object.values(row).some((value) => String(value || "").trim().length > 0);
    const mappedRow = mapSupplierRow(row);
    if (hasRowValue && String(mappedRow.supplier_name || "").trim().length > 0) rows.push(mappedRow);
  }

  return rows;
}

function parseCsvRows(text) {
  const cleanedText = String(text || "").replace(/^[﻿￾]+/, "");
  const firstLine = cleanedText.split(/\r?\n/)[0] || "";
  const delimiter = [",", ";", "\t", "|"]
    .map((delim) => ({ delim, count: (firstLine.match(new RegExp(`\\${delim}`, "g")) || []).length }))
    .sort((a, b) => b.count - a.count)[0]?.delim || ",";

  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < cleanedText.length; i += 1) {
    const ch = cleanedText[i];
    if (ch === "\"") {
      if (inQuotes && cleanedText[i + 1] === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      row.push(current.trim());
      current = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && cleanedText[i + 1] === "\n") i += 1;
      row.push(current.trim());
      current = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    current += ch;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function mapCsvToSupplierRows(csvText) {
  return parseMatrixToSupplierRows(parseCsvRows(csvText));
}

async function parseExcelToSupplierRows(file) {
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default ?? xlsxModule;
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  for (const sheetName of workbook.SheetNames || []) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const objectRows = XLSX.utils.sheet_to_json(sheet, {
      defval: "",
      raw: false,
      blankrows: false
    });

    if (Array.isArray(objectRows) && objectRows.length) {
      const normalizedRows = objectRows
        .map((row) => normalizeSupplierRowObject(row))
        .filter((row) => String(row.supplier_name || "").trim().length > 0);
      if (normalizedRows.length) return normalizedRows;
    }

    const matrixRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false
    });
    const parsedRows = parseMatrixToSupplierRows(matrixRows);
    if (parsedRows.length) return parsedRows;
  }

  return [];
}

function SectionFallback({ label = "Loading..." }) {
  return (
    <section className="masterdata-card">
      <p style={{ margin: 0, color: "#64748b" }}>{label}</p>
    </section>
  );
}

function SupplierMasterPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplierCode, setEditingSupplierCode] = useState("");
  const [deletingSupplierld, setDeletingSupplierld] = useState(null);
  const [masterData, setMasterData] = useState({});
  const [supplierForm, setSupplierForm] = useState(SUPPLIER_FORM_INITIAL);
  const [formErrors, setFormErrors] = useState({});
  const [importFileName, setImportFileName] = useState("");

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/master-data?force=true");
      setMasterData(data && typeof data === "object" ? data : {});
    } catch (error) {
      logApiError(error, "Failed to load master data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMasterData();
  }, [fetchMasterData]);

  const supplierRows = useMemo(() => {
    return Array.isArray(masterData.supplierMaster) ? masterData.supplierMaster : [];
  }, [masterData.supplierMaster]);

  const stateOptions = STATE_OPTIONS[supplierForm.country] || [];

  const onSupplierFieldChange = useCallback((key, value) => {
    setSupplierForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const closeSupplierModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingSupplierCode("");
    setSupplierForm(SUPPLIER_FORM_INITIAL);
    setFormErrors({});
  }, []);

  const openCreateSupplierModal = useCallback(() => {
    setEditingSupplierCode("");
    setSupplierForm(SUPPLIER_FORM_INITIAL);
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const openEditSupplierModal = useCallback((row) => {
    if (!row?.supplierCode) {
      window.alert("Supplier Code is required to update a row. Add code first, then update.");
      return;
    }

    setEditingSupplierCode(String(row.supplierCode));
    setSupplierForm({
      supplier_name: row.supplierName || "",
      gstn: row.gstn || "",
      pan_no: row.panNo || "",
      country: row.country || "",
      address: row.address || "",
      pincode: row.pincode || "",
      state: row.state || "",
      city: row.city || ""
    });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const validateSupplierForm = () => {
    const errors = {};
    if (!supplierForm.supplier_name.trim()) errors.supplier_name = "Supplier Name is required.";
    return errors;
  };

  const onSubmitSupplier = async (event) => {
    event.preventDefault();
    const errors = validateSupplierForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await api.post("/master-data/supplier-master/rows", supplierForm);
      closeSupplierModal();
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
    } catch (error) {
      logApiError(error, "Failed to save supplier master data");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteSupplier = useCallback(async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete supplier "${row.supplierName || row.supplierCode || row.id}"?`)) return;

    setDeletingSupplierld(row.id);
    try {
      await api.delete(`/master-data/supplier-master/rows/${row.id}`);
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
    } catch (error) {
      logApiError(error, "Failed to delete supplier master data");
    } finally {
      setDeletingSupplierld(null);
    }
  }, [fetchMasterData]);

  const onImportFileSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImporting(true);

    try {
      let rows = [];
      const fileType = file.type || "";
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileType.includes("spreadsheet")) {
        rows = await parseExcelToSupplierRows(file);
      } else {
        const text = await file.text();
        rows = mapCsvToSupplierRows(text);
      }

      if (!rows.length) {
        window.alert("No valid rows found in the file. Make sure the sheet has a header row with a 'Supplier Name' column.");
        return;
      }

      const { data } = await api.post("/master-data/supplier-master/import", { rows });
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
      window.alert(`Import completed. Total: ${data.total}, Imported: ${data.imported}, Failed: ${data.failed}`);
    } catch (error) {
      logApiError(error, "Failed to import supplier master file");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="masterdata-page">
      <section className="masterdata-card masterdata-header-card">
        <div className="masterdata-header-right">
          <div>
            <h2>Supplier Master Data</h2>
          </div>
          <button type="button" className="masterdata-btn-primary" onClick={openCreateSupplierModal}>
            + Add Supplier
          </button>
        </div>
      </section>

      <section className="masterdata-card">
        <div style={{ display: "grid", gap: "16px", flex: 1 }}>
          <label className="masterdata-label">Import Supplier Sheet (CSV or Excel)</label>
          <div className="masterdata-toolbar">
            <input
              type="file"
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={onImportFileSelected}
              disabled={importing}
              className="input"
            />
            {importing ? <small style={{ color: "#2563eb", fontWeight: 600 }}>Importing...</small> : null}
            {importFileName ? (
              <small style={{ color: "#6b7280" }}>
                Last selected: <strong>{importFileName}</strong>
              </small>
            ) : null}
          </div>
          <small style={{ color: "#9ca3af" }}>
            Expected columns: <em>Supplier Name, GSTN, PAN No, Country, State, City, Pincode, Address</em>
          </small>
        </div>
      </section>

      <Suspense fallback={<SectionFallback label="Loading records..." />}>
        <MasterDataSupplierTable
          loading={loading}
          supplierRows={supplierRows}
          onEditSupplier={openEditSupplierModal}
          onDeleteSupplier={onDeleteSupplier}
          deletingSupplierld={deletingSupplierld}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MasterDataSupplierModal
          isOpen={isModalOpen}
          saving={saving}
          editingSupplierCode={editingSupplierCode}
          supplierForm={supplierForm}
          formErrors={formErrors}
          stateOptions={stateOptions}
          countryOptions={COUNTRY_OPTIONS}
          onFieldChange={onSupplierFieldChange}
          onClose={closeSupplierModal}
          onSubmit={onSubmitSupplier}
        />
      </Suspense>
    </div>
  );
}

export default SupplierMasterPage;
