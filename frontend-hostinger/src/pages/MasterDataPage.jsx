import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";

const MasterDataHeader = lazy(() => import("../components/masterdata/MasterDataHeader"));
const MasterDataImportToolbar = lazy(() => import("../components/masterdata/MasterDataImportToolbar"));
const MasterDataCustomerTable = lazy(() => import("../components/masterdata/MasterDataCustomerTable"));
const MasterDataCustomerModal = lazy(() => import("../components/masterdata/MasterDataCustomerModal"));

const CUSTOMER_FORM_INITIAL = {
  customer_name: "",
  gstn: "",
  country: "",
  country_code: "",
  cust_initials: "",
  s_no_code: "",
  customer_code: "",
  contact_person: "",
  contact_person_number: "",
  company_email: "",
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

const CUSTOMER_HEADER_MAP = {
  customer: "customer_name",
  customername: "customer_name",
  name: "customer_name",
  gstn: "gstn",
  country: "country",
  countrycode: "country_code",
  custinitials: "cust_initials",
  custinitial: "cust_initials",
  customerinitials: "cust_initials",
  sno: "s_no_code",
  snocode: "s_no_code",
  serialcode: "s_no_code",
  serialnumber: "s_no_code",
  customer_code: "customer_code",
  customercode: "customer_code",
  customerid: "customer_code",
  contactperson: "contact_person",
  contactpersonname: "contact_person",
  contactpersonnumber: "contact_person_number",
  contactnumber: "contact_person_number",
  phone: "contact_person_number",
  mobile: "contact_person_number",
  email: "company_email",
  companyemail: "company_email",
  address: "address",
  addr: "address",
  pincode: "pincode",
  pin: "pincode",
  pin_code: "pincode",
  state: "state",
  city: "city"
};

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeHeader(header) {
  return String(header || "")
    .replace(/^[\uFEFF\uFFFE]+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function resolveCustomerHeader(header) {
  const normalized = normalizeHeader(header);
  if (CUSTOMER_HEADER_MAP[normalized]) return CUSTOMER_HEADER_MAP[normalized];
  if (normalized.includes("customer") && normalized.includes("name")) return "customer_name";
  if (normalized === "name") return "customer_name";
  if (normalized.includes("gst")) return "gstn";
  if (normalized.includes("country") && normalized.includes("code")) return "country_code";
  if (normalized === "country") return "country";
  if (normalized.includes("initial")) return "cust_initials";
  if (normalized.includes("serial") || normalized.includes("sno") || normalized.includes("no")) return "s_no_code";
  if (normalized.includes("customer") && normalized.includes("code")) return "customer_code";
  if (normalized.includes("code") && !normalized.includes("country")) return "customer_code";
  if (normalized.includes("contact") && normalized.includes("person") && normalized.includes("number")) return "contact_person_number";
  if (normalized.includes("contact") && normalized.includes("person")) return "contact_person";
  if (normalized.includes("phone") || normalized.includes("mobile")) return "contact_person_number";
  if (normalized.includes("email")) return "company_email";
  if (normalized.includes("address")) return "address";
  if (normalized.includes("pin")) return "pincode";
  if (normalized === "state") return "state";
  if (normalized === "city") return "city";
  return null;
}

function normalizeCustomerRowObject(sourceRow = {}) {
  const row = {};
  for (const [key, value] of Object.entries(sourceRow || {})) {
    const normalizedKey = resolveCustomerHeader(key);
    if (!normalizedKey) continue;
    row[normalizedKey] = String(value ?? "").trim();
  }
  return mapCustomerRow(row);
}

function scoreCustomerHeaderRow(row = []) {
  const resolved = row.map((item) => resolveCustomerHeader(item));
  const recognizedCount = resolved.filter(Boolean).length;
  const hasCustomerName = resolved.includes("customer_name") ? 5 : 0;
  const hasLocationFields = ["country", "state", "city", "pincode"].reduce(
    (score, key) => score + (resolved.includes(key) ? 1 : 0),
    0
  );
  return {
    resolved,
    score: recognizedCount + hasCustomerName + hasLocationFields
  };
}

function mapCustomerRow(row) {
  return {
    customer_name: row.customer_name || "",
    gstn: row.gstn || "",
    country: row.country || "",
    country_code: row.country_code || "",
    cust_initials: row.cust_initials || "",
    s_no_code: row.s_no_code || "",
    customer_code: row.customer_code || "",
    contact_person: row.contact_person || "",
    contact_person_number: row.contact_person_number || "",
    company_email: row.company_email || "",
    address: row.address || "",
    pincode: row.pincode || "",
    state: row.state || "",
    city: row.city || ""
  };
}

function parseMatrixToCustomerRows(matrix) {
  if (!Array.isArray(matrix) || matrix.length < 2) return [];

  const scanLimit = Math.min(matrix.length, 12);
  let bestHeaders = [];
  let bestScore = 0;
  let headerIndex = -1;

  for (let index = 0; index < scanLimit; index += 1) {
    const row = Array.isArray(matrix[index]) ? matrix[index] : [];
    const { resolved, score } = scoreCustomerHeaderRow(row);
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
    const mappedRow = mapCustomerRow(row);
    if (hasRowValue && String(mappedRow.customer_name || "").trim().length > 0) rows.push(mappedRow);
  }

  return rows;
}

function parseCsvRows(text) {
  const cleanedText = String(text || "").replace(/^[\uFEFF\uFFFE]+/, "");
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

function mapCsvToCustomerRows(csvText) {
  return parseMatrixToCustomerRows(parseCsvRows(csvText));
}

async function parseExcelToCustomerRows(file) {
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
        .map((row) => normalizeCustomerRowObject(row))
        .filter((row) => String(row.customer_name || "").trim().length > 0);
      if (normalizedRows.length) return normalizedRows;
    }

    const matrixRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      blankrows: false
    });
    const parsedRows = parseMatrixToCustomerRows(matrixRows);
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

function MasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerCode, setEditingCustomerCode] = useState("");
  const [deletingCustomerId, setDeletingCustomerId] = useState(null);
  const [masterData, setMasterData] = useState({});
  const [customerForm, setCustomerForm] = useState(CUSTOMER_FORM_INITIAL);
  const [formErrors, setFormErrors] = useState({});
  const [importFileName, setImportFileName] = useState("");

  const fetchMasterData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/master-data");
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

  const customerRows = useMemo(() => {
    return Array.isArray(masterData.customerMaster) ? masterData.customerMaster : [];
  }, [masterData.customerMaster]);

  const stateOptions = STATE_OPTIONS[customerForm.country] || [];

  const onCustomerFieldChange = useCallback((key, value) => {
    setCustomerForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const closeCustomerModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingCustomerCode("");
    setCustomerForm(CUSTOMER_FORM_INITIAL);
    setFormErrors({});
  }, []);

  const openCreateCustomerModal = useCallback(() => {
    setEditingCustomerCode("");
    setCustomerForm(CUSTOMER_FORM_INITIAL);
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const openEditCustomerModal = useCallback((row) => {
    if (!row?.customerCode) {
      window.alert("Customer Code is required to update a row. Add code first, then update.");
      return;
    }

    setEditingCustomerCode(String(row.customerCode));
    setCustomerForm({
      customer_name: row.customerName || "",
      gstn: row.gstn || "",
      country: row.country || "",
      country_code: row.countryCode || "",
      cust_initials: row.custInitials || "",
      s_no_code: row.sNoCode || "",
      customer_code: row.customerCode || "",
      contact_person: row.contactPerson || "",
      contact_person_number: row.contactPersonNumber || "",
      company_email: row.companyEmail || "",
      address: row.address || "",
      pincode: row.pincode || "",
      state: row.state || "",
      city: row.city || ""
    });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const validateCustomerForm = () => {
    const errors = {};
    if (!customerForm.customer_name.trim()) errors.customer_name = "Customer Name is required.";
    if (customerForm.company_email.trim() && !isValidEmail(customerForm.company_email.trim())) {
      errors.company_email = "Invalid email format.";
    }
    return errors;
  };

  const onSubmitCustomer = async (event) => {
    event.preventDefault();
    const errors = validateCustomerForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      await api.post("/master-data/customer-master/rows", customerForm);
      closeCustomerModal();
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
    } catch (error) {
      logApiError(error, "Failed to save customer master data");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteCustomer = useCallback(async (row) => {
    if (!row?.id) return;
    if (!window.confirm(`Delete customer "${row.customerName || row.customerCode || row.id}"?`)) return;

    setDeletingCustomerId(row.id);
    try {
      await api.delete(`/master-data/customer-master/rows/${row.id}`);
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
    } catch (error) {
      logApiError(error, "Failed to delete customer master data");
    } finally {
      setDeletingCustomerId(null);
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
        rows = await parseExcelToCustomerRows(file);
      } else {
        const text = await file.text();
        rows = mapCsvToCustomerRows(text);
      }

      if (!rows.length) {
        window.alert("No valid rows found in the file.");
        return;
      }

      const { data } = await api.post("/master-data/customer-master/import", { rows });
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
      window.alert(`Import completed. Total: ${data.total}, Imported: ${data.imported}, Failed: ${data.failed}`);
    } catch (error) {
      logApiError(error, "Failed to import customer master file");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  };

  return (
    <div className="masterdata-page">
      <Suspense fallback={<SectionFallback label="Loading header..." />}>
        <MasterDataHeader onAddCustomer={openCreateCustomerModal} />
      </Suspense>

      <Suspense fallback={<SectionFallback label="Loading import section..." />}>
        <MasterDataImportToolbar
          importing={importing}
          importFileName={importFileName}
          onImportFileSelected={onImportFileSelected}
        />
      </Suspense>

      <Suspense fallback={<SectionFallback label="Loading records..." />}>
        <MasterDataCustomerTable
          loading={loading}
          customerRows={customerRows}
          onEditCustomer={openEditCustomerModal}
          onDeleteCustomer={onDeleteCustomer}
          deletingCustomerId={deletingCustomerId}
        />
      </Suspense>

      <Suspense fallback={null}>
        <MasterDataCustomerModal
          isOpen={isModalOpen}
          saving={saving}
          editingCustomerCode={editingCustomerCode}
          customerForm={customerForm}
          formErrors={formErrors}
          stateOptions={stateOptions}
          countryOptions={COUNTRY_OPTIONS}
          onFieldChange={onCustomerFieldChange}
          onClose={closeCustomerModal}
          onSubmit={onSubmitCustomer}
        />
      </Suspense>
    </div>
  );
}

export default MasterDataPage;
