import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import api from "../api/axiosClient";
import { logApiError } from "../utils/apiError";

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
  const matrix = parseCsvRows(csvText);
  if (matrix.length < 2) return [];

  const headerMap = {
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

  const resolveHeader = (header) => {
    const normalized = normalizeHeader(header);
    if (headerMap[normalized]) return headerMap[normalized];
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
  };

  const headers = matrix[0].map((item) => resolveHeader(item));
  const rows = [];

  for (let i = 1; i < matrix.length; i += 1) {
    const line = matrix[i];
    const row = {};

    for (let j = 0; j < headers.length; j += 1) {
      const key = headers[j];
      if (!key) continue;
      row[key] = String(line[j] || "").trim();
    }

    const hasRowValue = Object.values(row).some((value) => String(value || "").trim().length > 0);
    if (hasRowValue) {
      rows.push({
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
      });
    }
  }

  return rows;
}

function parseExcelToCustomerRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (rows.length < 2) {
          resolve([]);
          return;
        }

        const headerMap = {
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

        const resolveHeader = (header) => {
          const normalized = normalizeHeader(header);
          if (headerMap[normalized]) return headerMap[normalized];
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
        };

        const headers = rows[0].map((item) => resolveHeader(item));
        const parsedRows = [];

        for (let i = 1; i < rows.length; i += 1) {
          const line = rows[i];
          const row = {};

          for (let j = 0; j < headers.length; j += 1) {
            const key = headers[j];
            if (!key) continue;
            row[key] = String(line[j] || "").trim();
          }

          const hasRowValue = Object.values(row).some((value) => String(value || "").trim().length > 0);
          if (hasRowValue) {
            parsedRows.push({
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
            });
          }
        }

        resolve(parsedRows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function MasterDataPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [masterData, setMasterData] = useState({});
  const [customerForm, setCustomerForm] = useState(CUSTOMER_FORM_INITIAL);
  const [formErrors, setFormErrors] = useState({});
  const [importFileName, setImportFileName] = useState("");

  const fetchMasterData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/master-data");
      setMasterData(data && typeof data === "object" ? data : {});
    } catch (error) {
      logApiError(error, "Failed to load master data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMasterData();
  }, []);

  const customerRows = useMemo(() => {
    return Array.isArray(masterData.customerMaster) ? masterData.customerMaster : [];
  }, [masterData.customerMaster]);
  const stateOptions = STATE_OPTIONS[customerForm.country] || [];

  const onCustomerFieldChange = (key, value) => {
    setCustomerForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateCustomerForm = () => {
    const errors = {};
    if (!customerForm.customer_name.trim()) errors.customer_name = "Customer Name is required.";
    if (!customerForm.country.trim()) errors.country = "Country is required.";
    if (!customerForm.state.trim()) errors.state = "State is required.";
    if (!customerForm.city.trim()) errors.city = "City is required.";
    if (!customerForm.contact_person.trim()) errors.contact_person = "Contact Person is required.";
    if (!customerForm.contact_person_number.trim()) errors.contact_person_number = "Phone Number is required.";
    if (!customerForm.company_email.trim()) errors.company_email = "Company Email is required.";
    if (!isValidEmail(customerForm.company_email.trim())) errors.company_email = "Invalid email format.";
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
      setCustomerForm(CUSTOMER_FORM_INITIAL);
      setFormErrors({});
      setIsModalOpen(false);
      await fetchMasterData();
      window.dispatchEvent(new Event("master-data-updated"));
    } catch (error) {
      logApiError(error, "Failed to save customer master data");
    } finally {
      setSaving(false);
    }
  };

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
      <section className="masterdata-card masterdata-header-card">
        <div className="masterdata-header-right">
          <div>
            <h2>Customer Master Data</h2>
            <p>Central source for customer fields used across the system</p>
          </div>
          <button className="masterdata-btn-primary" onClick={() => setIsModalOpen(true)}>
            + Add Customer
          </button>
        </div>
      </section>

      <section className="masterdata-card">
        <div style={{ display: "grid", gap: "16px", flex: 1 }}>
          <label className="masterdata-label">Import Customer Sheet (CSV or Excel)</label>
          <div className="masterdata-toolbar">
            <input 
              type="file" 
              accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" 
              onChange={onImportFileSelected} 
              disabled={importing} 
              className="input" 
            />
            {importing && <small style={{ color: "#2563eb", fontWeight: 600 }}>📤 Importing...</small>}
            {importFileName && <small style={{ color: "#6b7280" }}>✓ Last selected: <strong>{importFileName}</strong></small>}
          </div>
        </div>
      </section>

      <section className="masterdata-card">
        <div className="masterdata-section-head">
          <h3>📋 Master Records ({customerRows.length})</h3>
        </div>
        {loading ? (
          <p style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>Loading customer master data...</p>
        ) : customerRows.length ? (
          <div className="masterdata-table-wrap">
            <table className="masterdata-table">
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>GSTN</th>
                  <th>Country</th>
                  <th>Country Code</th>
                  <th>Cust Initials</th>
                  <th>S. No Code</th>
                  <th>Customer Code</th>
                  <th>Contact Person</th>
                  <th>Contact Person Number</th>
                  <th>Company Email</th>
                  <th>Address</th>
                  <th>Pincode</th>
                  <th>State</th>
                  <th>City</th>
                </tr>
              </thead>
              <tbody>
                {customerRows.map((row) => (
                  <tr key={row.id || row.customerCode}>
                    <td>{row.customerName || "-"}</td>
                    <td>{row.gstn || "-"}</td>
                    <td>{row.country || "-"}</td>
                    <td>{row.countryCode || "-"}</td>
                    <td>{row.custInitials || "-"}</td>
                    <td>{row.sNoCode || "-"}</td>
                    <td>{row.customerCode || "-"}</td>
                    <td>{row.contactPerson || "-"}</td>
                    <td>{row.contactPersonNumber || "-"}</td>
                    <td>{row.companyEmail || "-"}</td>
                    <td>{row.address || "-"}</td>
                    <td>{row.pincode || "-"}</td>
                    <td>{row.state || "-"}</td>
                    <td>{row.city || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ padding: "24px", textAlign: "center", color: "#6b7280" }}>
            📭 No customer records yet. Click <strong>"Add Customer"</strong> button above to get started.
          </p>
        )}
      </section>

      {isModalOpen && (
        <div className="masterdata-modal-overlay">
          <div className="masterdata-modal-card">
            <div className="masterdata-modal-head">
              <div>
                <h3>➕ Add New Customer</h3>
                <p>Fill in customer details. Required fields are marked with *</p>
              </div>
              <button 
                className="masterdata-modal-close" 
                onClick={() => setIsModalOpen(false)} 
                disabled={saving}
                type="button"
              >
                ✕ Close
              </button>
            </div>

            <form className="masterdata-customer-form" onSubmit={onSubmitCustomer}>
              <section className="masterdata-form-section">
                <h4>Basic Information</h4>
                <div className="masterdata-form-grid-two">
                  <div>
                    <label className="label">Customer Name <span className="req">*</span></label>
                    <input
                      className="input"
                      placeholder="Enter customer name"
                      value={customerForm.customer_name}
                      onChange={(e) => onCustomerFieldChange("customer_name", e.target.value)}
                      required
                    />
                    {formErrors.customer_name ? <small style={{ color: "#dc2626" }}>{formErrors.customer_name}</small> : null}
                  </div>
                  <div>
                    <label className="label">Customer Code</label>
                    <input
                      className="input"
                      placeholder="Enter customer code"
                      value={customerForm.customer_code}
                      onChange={(e) => onCustomerFieldChange("customer_code", e.target.value)}
                    />
                    {formErrors.customer_code ? <small style={{ color: "#dc2626" }}>{formErrors.customer_code}</small> : null}
                  </div>
                  <div>
                    <label className="label">Cust Initials</label>
                    <input
                      className="input"
                      placeholder="e.g. ABC"
                      value={customerForm.cust_initials}
                      onChange={(e) => onCustomerFieldChange("cust_initials", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="masterdata-form-section">
                <h4>Location Details</h4>
                <div className="masterdata-form-grid-two">
                  <div>
                    <label className="label">Country <span className="req">*</span></label>
                    <select
                      className="input"
                      value={customerForm.country}
                      onChange={(e) => {
                        const selectedCountry = e.target.value;
                        onCustomerFieldChange("country", selectedCountry);
                        const matching = COUNTRY_OPTIONS.find((item) => item.value === selectedCountry);
                        if (matching) onCustomerFieldChange("country_code", matching.code);
                      }}
                      required
                    >
                      <option value="">Select country</option>
                      {COUNTRY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.value}</option>
                      ))}
                    </select>
                    {formErrors.country ? <small style={{ color: "#dc2626" }}>{formErrors.country}</small> : null}
                  </div>
                  <div>
                    <label className="label">Country Code</label>
                    <input
                      className="input"
                      placeholder="IN"
                      value={customerForm.country_code}
                      onChange={(e) => onCustomerFieldChange("country_code", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">State <span className="req">*</span></label>
                    <select
                      className="input"
                      value={customerForm.state}
                      onChange={(e) => onCustomerFieldChange("state", e.target.value)}
                      required
                    >
                      <option value="">Select state</option>
                      {stateOptions.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                    {formErrors.state ? <small style={{ color: "#dc2626" }}>{formErrors.state}</small> : null}
                  </div>
                  <div>
                    <label className="label">City <span className="req">*</span></label>
                    <input
                      className="input"
                      placeholder="Enter city"
                      value={customerForm.city}
                      onChange={(e) => onCustomerFieldChange("city", e.target.value)}
                      required
                    />
                    {formErrors.city ? <small style={{ color: "#dc2626" }}>{formErrors.city}</small> : null}
                  </div>
                  <div>
                    <label className="label">Pincode</label>
                    <input
                      className="input"
                      placeholder="Enter pincode"
                      value={customerForm.pincode}
                      onChange={(e) => onCustomerFieldChange("pincode", e.target.value)}
                    />
                  </div>
                  <div className="full-row">
                    <label className="label">Address</label>
                    <input
                      className="input"
                      placeholder="Enter full address"
                      value={customerForm.address}
                      onChange={(e) => onCustomerFieldChange("address", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="masterdata-form-section">
                <h4>Business Details</h4>
                <div className="masterdata-form-grid-two">
                  <div>
                    <label className="label">GSTN</label>
                    <input
                      className="input"
                      placeholder="Enter GSTN"
                      value={customerForm.gstn}
                      onChange={(e) => onCustomerFieldChange("gstn", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label">Serial Code</label>
                    <input
                      className="input"
                      placeholder="Enter serial code"
                      value={customerForm.s_no_code}
                      onChange={(e) => onCustomerFieldChange("s_no_code", e.target.value)}
                    />
                  </div>
                </div>
              </section>

              <section className="masterdata-form-section">
                <h4>Contact Information</h4>
                <div className="masterdata-form-grid-two">
                  <div>
                    <label className="label">Contact Person <span className="req">*</span></label>
                    <input
                      className="input"
                      placeholder="Enter contact person"
                      value={customerForm.contact_person}
                      onChange={(e) => onCustomerFieldChange("contact_person", e.target.value)}
                      required
                    />
                    {formErrors.contact_person ? <small style={{ color: "#dc2626" }}>{formErrors.contact_person}</small> : null}
                  </div>
                  <div>
                    <label className="label">Phone Number <span className="req">*</span></label>
                    <input
                      className="input"
                      placeholder="Enter phone number"
                      value={customerForm.contact_person_number}
                      onChange={(e) => onCustomerFieldChange("contact_person_number", e.target.value)}
                      required
                    />
                    {formErrors.contact_person_number ? <small style={{ color: "#dc2626" }}>{formErrors.contact_person_number}</small> : null}
                  </div>
                  <div className="full-row">
                    <label className="label">Company Email <span className="req">*</span></label>
                    <input
                      className="input"
                      type="email"
                      placeholder="name@company.com"
                      value={customerForm.company_email}
                      onChange={(e) => onCustomerFieldChange("company_email", e.target.value)}
                      required
                    />
                    {formErrors.company_email ? <small style={{ color: "#dc2626" }}>{formErrors.company_email}</small> : null}
                  </div>
                </div>
              </section>

              <div className="masterdata-form-actions" style={{ marginTop: "24px", paddingTop: "24px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button type="button" className="masterdata-btn-secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="masterdata-btn-primary" disabled={saving}>
                  {saving ? "💾 Saving..." : "✓ Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataPage;
