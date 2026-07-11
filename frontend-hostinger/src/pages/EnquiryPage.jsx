import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { EditIcon, EyeIcon, InboxIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { CURRENCY_OPTIONS, formatPriceValue } from "../utils/commerce";
import { getDisplayEnquiryNumber } from "../utils/businessNumbers";
import { formatEnquiryProducts, normalizeEnquiryProductRows } from "../utils/enquiryProducts";
import { SAMPLED_FOLLOW_UP_DAYS, buildFollowUpMessage, getFollowUpEnquiries } from "../utils/followUps";
import SearchableSelect from "../components/common/SearchableSelect";

function prettyLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function toDateInput(dateValue) {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function getStatusClass(status) {
  if (status === "ACCEPTED") return "approved";
  if (status === "REJECTED") return "rejected";
  if (status === "PENDING") return "pending";
  return "new";
}

function createEmptyForm() {
  return {
    enquiry_date: "",
    mode_of_enquiry: "",
    company_name: "",
    customer_type: "",
    enquiry_type: "",
    price: "",
    currency: "INR",
    product: "",
    products: [createEmptyProductRow()],
    expected_timeline: "",
    assigned_person: "",
    inco_term: "",
    country: "",
    port: "",
    last_transaction: "",
    notes_for_production: "",
    stage: "GENERAL",
    is_urgent: false
  };
}

const STAGE_OPTIONS = [
  { value: "GENERAL", label: "General" },
  { value: "SAMPLED", label: "Sampled" },
  { value: "QUOTED", label: "Quoted" }
];

function createEmptyProductRow() {
  return { product: "", grade: "", quantity: "", unit_of_measurement: "", price_per_uom: "" };
}

function getEnquiryProducts(enquiry) {
  return normalizeEnquiryProductRows(enquiry?.products ?? enquiry?.product);
}

function getEnquiryProductGrades(enquiry) {
  return getEnquiryProducts(enquiry)
    .map((row) => row.grade)
    .filter(Boolean)
    .join(", ");
}

const UNIT_OPTIONS = ["MT", "KG"];
const INCO_TERMS = [
  { value: "EXW", label: "EXW (Ex Works)" },
  { value: "FCA", label: "FCA (Free Carrier)" },
  { value: "FAS", label: "FAS (Free Alongside Ship)" },
  { value: "FOB", label: "FOB (Free on Board)" },
  { value: "CFR", label: "CFR (Cost and Freight)" },
  { value: "CIF", label: "CIF (Cost, Insurance and Freight)" },
  { value: "CPT", label: "CPT (Carriage Paid To)" },
  { value: "CIP", label: "CIP (Carriage and Insurance Paid)" },
  { value: "DAP", label: "DAP (Delivered at Place)" },
  { value: "DPU", label: "DPU (Delivered at Place Unloaded)" },
  { value: "DDP", label: "DDP (Delivered Duty Paid)" }
];
const COUNTRY_OPTIONS_INTL = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada",
  "Cape Verde", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia",
  "Cuba", "Cyprus", "Czech Republic", "Czechia", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "East Timor", "Ecuador",
  "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Korea North", "Korea South", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya",
  "Liechtenstein", "Lithuania", "Luxembourg", "Macao", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
  "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco",
  "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru",
  "Philippines", "Poland", "Portugal", "Puerto Rico", "Qatar", "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore",
  "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname",
  "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago",
  "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

function EnquiryPage() {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEnquiryId, setEditingEnquiryId] = useState(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [assignedFilter, setAssignedFilter] = useState("");
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) { setDateFilter(""); } }, [isMobile]);
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [enquiries, setEnquiries] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const canManageEnquiries = user?.role === "admin" || user?.role === "sales";
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep-link: /enquiries?new=1 opens the create sheet directly (from mobile Today tiles).
  useEffect(() => {
    if (searchParams.get("new") === "1" && canManageEnquiries) {
      setEditingEnquiryId(null);
      resetForm();
      setIsCreateModalOpen(true);
      searchParams.delete("new");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canManageEnquiries]);

  // Sampled enquiries that have gone quiet for 12+ days.
  const followUps = useMemo(() => getFollowUpEnquiries(enquiries), [enquiries]);

  const tableWrapRef = useRef(null);
  const statusOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      ...masterData.enquiryStatuses.map((status) => ({
        value: status.value,
        label: prettyLabel(status.label || status.value)
      }))
    ],
    [masterData.enquiryStatuses]
  );
  const companyOptions = useMemo(
    () => (Array.isArray(masterData.companyNames) ? masterData.companyNames : []),
    [masterData.companyNames]
  );
  const fetchEnquiries = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/enquiries", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          assigned: assignedFilter || undefined,
          date: dateFilter || undefined,
          page: currentPage,
          limit: PAGE_SIZE
        }
      });
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      const pagination = data?.pagination || null;
      setEnquiries(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
    } catch (error) {
      logApiError(error, "Failed to fetch enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, [query, statusFilter, assignedFilter, dateFilter, currentPage]);

  const pendingCount = useMemo(
    () => enquiries.filter((item) => item.status === "PENDING").length,
    [enquiries]
  );

  const sortedEnquiries = useMemo(() => {
    const sorted = [...enquiries];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (item) => {
      if (key === "id") return Number(item.id || 0);
      if (key === "enquiryDate") return new Date(item.enquiryDate || 0).getTime();
      if (key === "companyName") return String(item.companyName || "").toLowerCase();
      if (key === "product") return formatEnquiryProducts(item).toLowerCase();
      if (key === "grade") return getEnquiryProductGrades(item).toLowerCase();
      if (key === "quantity") return Number(item.quantity || 0);
      if (key === "expectedTimeline") return new Date(item.expectedTimeline || 0).getTime();
      if (key === "status") return String(item.status || "").toLowerCase();
      return "";
    };

    sorted.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      return 0;
    });

    return sorted;
  }, [enquiries, sortConfig]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const onSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const onSearchSubmit = () => {
    const nextQuery = searchText.trim();
    setQuery(nextQuery);
    setCurrentPage(1);
  };

  const resetForm = () => {
    setForm(createEmptyForm());
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canManageEnquiries) return;
    const productRows = (form.products || [])
      .map((row) => ({
        product: String(row.product || "").trim(),
        grade: String(row.grade || "").trim(),
        quantity: Number(row.quantity || 0),
        unit_of_measurement: String(row.unit_of_measurement || "").trim()
      }))
      .filter((row) => row.product);

    if (!productRows.length) {
      window.alert("Add at least one product before saving the enquiry.");
      return;
    }

    const invalidRow = productRows.find((row) => !row.grade || !row.quantity || !row.unit_of_measurement);
    if (invalidRow) {
      window.alert("Fill product, grade, quantity, and unit of measurement for each row.");
      return;
    }

    // An urgent enquiry skips approval and immediately creates a sales order
    // and a production job, so make the user acknowledge that before saving.
    if (form.is_urgent && !editingEnquiryId) {
      const proceed = window.confirm(
        "Marked URGENT.\n\n"
        + "Saving this will immediately create a sales order and a production job, "
        + "skipping the approval queue. It will also jump to the front of the production line.\n\n"
        + "Create it now?"
      );
      if (!proceed) return;
    }

    const totalQuantity = productRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const unitValues = Array.from(new Set(productRows.map((row) => row.unit_of_measurement).filter(Boolean)));
    const unitOfMeasurement = unitValues.length === 1 ? unitValues[0] : null;

    setSaving(true);
    try {
      const productSummary = productRows
        .map((row) => {
          const pieces = [row.product];
          if (row.grade) pieces.push(row.grade);
          pieces.push(`${row.quantity} ${row.unit_of_measurement}`);
          return pieces.join(" - ");
        })
        .join(", ");
      const payload = {
        ...form,
        product: productSummary,
        products: productRows,
        quantity: totalQuantity,
        price: form.price === "" ? null : Number(form.price),
        currency: form.currency || null,
        mode_of_enquiry: form.mode_of_enquiry || null,
        customer_type: form.customer_type || null,
        enquiry_type: form.enquiry_type || null,
        inco_term: form.inco_term || null,
        country: form.country || null,
        port: form.port || null,
        last_transaction: form.last_transaction || null,
        unit_of_measurement: unitOfMeasurement,
        notes_for_production: form.notes_for_production || null,
        stage: form.stage || "GENERAL",
        is_urgent: Boolean(form.is_urgent)
      };

      if (editingEnquiryId) {
        await api.put(`/enquiries/${editingEnquiryId}/edit`, payload);
      } else {
        await api.post("/enquiries", payload);
      }
      resetForm();
      setEditingEnquiryId(null);
      setIsCreateModalOpen(false);
      await fetchEnquiries();
    } catch (error) {
      logApiError(error, "Failed to save enquiry");
    } finally {
      setSaving(false);
    }
  };

  const exportEnquiries = async () => {
    let exportSource = sortedEnquiries;
    try {
      const { data } = await api.get("/enquiries", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          assigned: assignedFilter || undefined,
          date: dateFilter || undefined,
          page: 1,
          limit: 0
        }
      });
      exportSource = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : sortedEnquiries;
    } catch {
      // Fall back to loaded page.
    }

    exportRowsToExcel(
      `enquiries_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "enquiryNumber", header: "Enquiry ID" },
        { key: "id", header: "ID" },
        { key: "enquiryDate", header: "Enquiry Date" },
        { key: "modeOfEnquiry", header: "Mode of Enquiry" },
        { key: "companyName", header: "Company" },
        { key: "product", header: "Product Summary" },
        { key: "products", header: "Products" },
        { key: "grade", header: "Grade" },
        { key: "quantity", header: "Quantity" },
        { key: "price", header: "Price" },
        { key: "currency", header: "Currency" },
        { key: "unitOfMeasurement", header: "Unit of Measurement" },
        { key: "expectedTimeline", header: "Expected Timeline" },
        { key: "assignedPerson", header: "Assigned User" },
        { key: "notesForProduction", header: "Notes for Production Team" },
        { key: "status", header: "Status" }
      ],
      exportSource.map((item) => ({
        ...item,
        enquiryNumber: getDisplayEnquiryNumber(item),
        enquiryDate: formatDate(item.enquiryDate),
        modeOfEnquiry: item.modeOfEnquiry || "-",
        product: formatEnquiryProducts(item) || "-",
        products: formatEnquiryProducts(item) || "-",
        grade: getEnquiryProductGrades(item) || "-",
        price: formatPriceValue(item.price),
        currency: item.currency || "-",
        unitOfMeasurement: item.unitOfMeasurement || "-",
        expectedTimeline: formatDate(item.expectedTimeline),
        notesForProduction: item.notesForProduction || "-"
      }))
    );
  };

  const onEdit = (enquiry) => {
    const enquiryProducts = getEnquiryProducts(enquiry);
    setEditingEnquiryId(enquiry.id);
    setForm({
      enquiry_date: toDateInput(enquiry.enquiryDate),
      mode_of_enquiry: enquiry.modeOfEnquiry || "",
      company_name: enquiry.companyName || "",
      customer_type: enquiry.customerType || "",
      enquiry_type: enquiry.enquiryType || "",
      price: enquiry.price ?? "",
      currency: enquiry.currency || "",
      product: enquiry.product || "",
      products: enquiryProducts.length ? enquiryProducts : [createEmptyProductRow()],
      expected_timeline: toDateInput(enquiry.expectedTimeline),
      assigned_person: enquiry.assignedPerson || "",
      inco_term: enquiry.incoTerm || "",
      country: enquiry.country || "",
      port: enquiry.port || "",
      last_transaction: enquiry.lastTransaction || "",
      notes_for_production: enquiry.notesForProduction || "",
      stage: enquiry.stage || "GENERAL",
      is_urgent: Boolean(enquiry.isUrgent)
    });
    setIsCreateModalOpen(true);
  };

  const onDelete = async (enquiryId) => {
    if (!window.confirm("Delete this enquiry?")) return;
    try {
      await api.delete(`/enquiries/${enquiryId}`);
      await fetchEnquiries();
    } catch (error) {
      logApiError(error, "Failed to delete enquiry");
    }
  };

  return (
    <div className="enquiry-page">
      {followUps.length > 0 && (
        <div className="followup-banner" role="status">
          <span className="followup-banner-icon" aria-hidden="true">⏰</span>
          <div>
            <strong>Follow-up needed.</strong>{" "}
            {followUps.length === 1
              ? buildFollowUpMessage(followUps[0])
              : `${followUps.length} sampled enquiries have had no quote for over ${SAMPLED_FOLLOW_UP_DAYS} days — follow up with these clients:`}
            {followUps.length > 1 && (
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {followUps.slice(0, 5).map((enquiry) => (
                  <li key={enquiry.id}>{buildFollowUpMessage(enquiry)}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <section className="enquiry-card enquiry-header-card">
        <div className="enquiry-header-left">
          <h2>Enquiry </h2>
        </div>
        <div className="enquiry-header-actions">
          <span className="enquiry-pending-badge">Pending: {pendingCount}</span>
          {canManageEnquiries && (
            <button
              className="enquiry-btn-primary"
              onClick={() => {
                setEditingEnquiryId(null);
                resetForm();
                setIsCreateModalOpen(true);
              }}
            >
              Create Enquiry
            </button>
          )}
        </div>
      </section>

      <section className="enquiry-card">
        <div className="enquiry-search-wrap">
          <SearchIcon />
          <input
            className="enquiry-search-input"
            placeholder="Search by company, product, or person"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchSubmit();
            }}
          />
        </div>

        <div className="enquiry-toolbar">
          <div className="enquiry-filter-grid">
            <SearchableSelect
              options={statusOptions}
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
              placeholder="All Status"
            />
            {!isMobile && <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} />}
            <input
              type="text"
              placeholder="Filter by assigned"
              value={assignedFilter}
              onChange={(event) => { setAssignedFilter(event.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="enquiry-toolbar-actions">
            <button className="enquiry-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
            <button className="enquiry-btn-secondary" onClick={exportEnquiries}>Export to Excel</button>
          </div>
        </div>

        {loading ? (
          <div className="enquiry-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="enquiry-skeleton-row" />)}
          </div>
        ) : sortedEnquiries.length ? (
          <>
            <div className="enquiry-table-wrap" ref={tableWrapRef}>
              <div className="enquiry-table-meta">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRecords)}-
                {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} records
              </div>
              <table className="enquiry-table">
                <thead>
                  <tr>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("id")}>Enquiry ID</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("enquiryDate")}>Enquiry Date</button></th>
                    <th>Mode of Enquiry</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("companyName")}>Company</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("grade")}>Grade</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("quantity")}>Quantity</button></th>
                    <th>Price</th>
                    <th>Currency</th>
                    <th>Unit of Measurement</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("expectedTimeline")}>Expected Timeline</button></th>
                    <th>Assigned To</th>
                    <th>Notes for Production Team</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  rows={sortedEnquiries}
                  colSpan={15}
                  rowHeight={52}
                  overscan={8}
                  scrollContainerRef={tableWrapRef}
                  getRowKey={(enquiry) => enquiry.id}
                  renderRow={(enquiry) => (
                    <tr key={enquiry.id}>
                      <td>{getDisplayEnquiryNumber(enquiry)}</td>
                      <td>{formatDate(enquiry.enquiryDate)}</td>
                      <td>{enquiry.modeOfEnquiry || "-"}</td>
                      <td>{enquiry.companyName}</td>
                      <td>{formatEnquiryProducts(enquiry) || "-"}</td>
                      <td>{getEnquiryProductGrades(enquiry) || "-"}</td>
                      <td>{enquiry.quantity}</td>
                      <td>{formatPriceValue(enquiry.price)}</td>
                      <td>{enquiry.currency || "-"}</td>
                      <td>{enquiry.unitOfMeasurement || "-"}</td>
                      <td>{formatDate(enquiry.expectedTimeline)}</td>
                      <td>{enquiry.assignedPerson}</td>
                      <td>{enquiry.notesForProduction || "-"}</td>
                      <td>
                        <span className={`enquiry-status ${getStatusClass(enquiry.status)}`}>{enquiry.status}</span>
                      </td>
                      <td>
                        <div className="enquiry-row-actions">
                          <button className="icon-btn" onClick={() => setSelectedEnquiry(enquiry)} aria-label="View enquiry"><EyeIcon /></button>
                          {canManageEnquiries && <button className="icon-btn" onClick={() => onEdit(enquiry)} aria-label="Edit enquiry"><EditIcon /></button>}
                          {canManageEnquiries && <button className="icon-btn danger" onClick={() => onDelete(enquiry.id)} aria-label="Delete enquiry"><TrashIcon /></button>}
                        </div>
                      </td>
                    </tr>
                  )}
                />
              </table>
            </div>
            <div className="enquiry-pagination">
              <div className="enquiry-pagination-info">Page {currentPage} of {totalPages}</div>
              <div className="enquiry-page-controls">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <div className="enquiry-empty-state">
            <div className="enquiry-empty-icon"><InboxIcon /></div>
            <p>No enquiries found</p>
            {canManageEnquiries && (
              <button
                className="enquiry-btn-primary"
                onClick={() => {
                  setEditingEnquiryId(null);
                  resetForm();
                  setIsCreateModalOpen(true);
                }}
              >
                Create Enquiry
              </button>
            )}
          </div>
        )}
      </section>

      {selectedEnquiry && (
        <div className="enquiry-modal-overlay">
          <div className="enquiry-modal-card">
            <div className="enquiry-modal-head">
              <div>
                <h3>Enquiry Details</h3>
                <p>{getDisplayEnquiryNumber(selectedEnquiry)} - {selectedEnquiry.companyName}</p>
              </div>
              <button className="enquiry-modal-close-btn" onClick={() => setSelectedEnquiry(null)}>Close</button>
            </div>
            <div className="enquiry-detail-grid">
              <p><span>Enquiry Date:</span> {formatDate(selectedEnquiry.enquiryDate)}</p>
              <p><span>Enquiry ID:</span> {getDisplayEnquiryNumber(selectedEnquiry)}</p>
              <p><span>Mode of Enquiry:</span> {selectedEnquiry.modeOfEnquiry || "-"}</p>
              <p><span>Products:</span> {formatEnquiryProducts(selectedEnquiry) || "-"}</p>
              <p><span>Grade:</span> {getEnquiryProductGrades(selectedEnquiry) || "-"}</p>
              <p><span>Quantity:</span> {selectedEnquiry.quantity}</p>
              <p><span>Price:</span> {formatPriceValue(selectedEnquiry.price)}</p>
              <p><span>Currency:</span> {selectedEnquiry.currency || "-"}</p>
              <p><span>Unit of Measurement:</span> {selectedEnquiry.unitOfMeasurement || "-"}</p>
              <p><span>Expected Timeline:</span> {formatDate(selectedEnquiry.expectedTimeline)}</p>
              <p><span>Assigned To:</span> {selectedEnquiry.assignedPerson}</p>
              <p><span>Status:</span> {selectedEnquiry.status}</p>
              <p><span>Notes for Production Team:</span> {selectedEnquiry.notesForProduction || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {isCreateModalOpen && canManageEnquiries && (
        <div className="enquiry-modal-overlay">
          <div className="enquiry-modal-card">
            <div className="enquiry-modal-head">
              <div>
                <h3>{editingEnquiryId ? "Edit Enquiry" : "Create Enquiry"}</h3>
                <p>{editingEnquiryId ? "Update enquiry details." : "Add a new enquiry record."}</p>
              </div>
              <button
                className="enquiry-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={saving}
              >
                Close
              </button>
            </div>
            <form className="enquiry-form-grid" onSubmit={submit}>
              <div>
                <label>Enquiry Date*</label>
                <input type="date" value={form.enquiry_date} onChange={(e) => setForm((p) => ({ ...p, enquiry_date: e.target.value }))} required />
              </div>
              <div>
                <label>Customer Type*</label>
                <select value={form.customer_type} onChange={(e) => setForm((p) => ({ ...p, customer_type: e.target.value }))} required>
                  <option value="">Select customer type</option>
                  <option value="Old">Old Customer</option>
                  <option value="New">New Customer</option>
                </select>
              </div>
              <div>
                <label>Enquiry Type*</label>
                <select value={form.enquiry_type} onChange={(e) => setForm((p) => ({ ...p, enquiry_type: e.target.value }))} required>
                  <option value="">Select enquiry type</option>
                  <option value="Domestic">Domestic</option>
                  <option value="International">International</option>
                </select>
              </div>
              {form.customer_type && form.enquiry_type && (
                <div style={{ gridColumn: '1 / -1', padding: '12px', backgroundColor: '#f0f9ff', borderRadius: '4px', marginBottom: '12px', fontSize: '13px', color: '#0369a1' }}>
                  Form for: {form.customer_type} Customer - {form.enquiry_type} Enquiry
                </div>
              )}
              <div>
                <label>Mode of Enquiry</label>
                <SearchableSelect
                  options={masterData.modeOfEnquiry}
                  value={form.mode_of_enquiry}
                  onChange={(value) => setForm((p) => ({ ...p, mode_of_enquiry: value }))}
                  placeholder="Select mode"
                />
              </div>
              <div>
                <label>Company Name*</label>
                <SearchableSelect
                  options={companyOptions}
                  value={form.company_name}
                  onChange={(value) => setForm((p) => ({ ...p, company_name: value }))}
                  placeholder="Search or select company"
                  allowCustom
                />
              </div>
              {form.enquiry_type === "International" && (
                <>
                  <div>
                    <label>Inco Term*</label>
                    <select value={form.inco_term} onChange={(e) => setForm((p) => ({ ...p, inco_term: e.target.value }))} required>
                      <option value="">Select Inco Term</option>
                      {INCO_TERMS.map((term) => (
                        <option key={term.value} value={term.value}>{term.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Country*</label>
                    <select value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} required>
                      <option value="">Select country</option>
                      {COUNTRY_OPTIONS_INTL.map((country) => (
                        <option key={country} value={country}>{country}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Port*</label>
                    <input
                      type="text"
                      value={form.port}
                      onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
                      placeholder="Enter port name"
                      required
                    />
                  </div>
                </>
              )}
              {form.customer_type === "Old" && (
                <div className="full-row">
                  <label>Last Transaction Details</label>
                  <textarea
                    rows="4"
                    value={form.last_transaction}
                    onChange={(e) => setForm((p) => ({ ...p, last_transaction: e.target.value }))}
                    placeholder="Enter previous transaction details:&#10;Product: [Product Name]&#10;Grade: [Grade]&#10;UOM: [MT/KG]&#10;Packaging: [Packaging Details]"
                  />
                </div>
              )}
              {form.enquiry_type === "International" && (
                <div>
                  <label>Currency</label>
                  <SearchableSelect
                    options={CURRENCY_OPTIONS}
                    value={form.currency}
                    onChange={(value) => setForm((p) => ({ ...p, currency: value }))}
                    placeholder="Select currency"
                  />
                </div>
              )}
              <div className="full-row">
                <label>Products Enquired*</label>
                <div className="enquiry-product-rows">
                  {(form.products || []).map((row, index) => (
                    <div key={index} className="enquiry-product-row">
                      <div>
                        <label>Product</label>
                        <SearchableSelect
                          options={masterData.products}
                          value={row.product}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, product: value } : item
                              )
                            }))
                          }
                          placeholder="Select product"
                        />
                      </div>
                      <div>
                        <label>Grade *</label>
                        <input
                          type="text"
                          value={row.grade}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, grade: e.target.value } : item
                              )
                            }))
                          }
                          placeholder="Enter grade"
                          required
                        />
                      </div>
                      <div>
                        <label>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={row.quantity}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, quantity: e.target.value } : item
                              )
                            }))
                          }
                          placeholder="Enter quantity"
                        />
                      </div>
                      <div>
                        <label>Unit of Measurement</label>
                        <SearchableSelect
                          options={UNIT_OPTIONS.map((unit) => ({ value: unit, label: unit }))}
                          value={row.unit_of_measurement}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, unit_of_measurement: value } : item
                              )
                            }))
                          }
                          placeholder="Select unit"
                        />
                      </div>
                      <div>
                        <label>Price per {row.unit_of_measurement || "UOM"}</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price_per_uom}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, price_per_uom: e.target.value } : item
                              )
                            }))
                          }
                          placeholder="Enter price per UOM"
                        />
                      </div>
                      <div className="enquiry-product-row-actions">
                        <button
                          type="button"
                          className="enquiry-btn-secondary"
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              products:
                                prev.products.length > 1
                                  ? prev.products.filter((_, rowIndex) => rowIndex !== index)
                                  : [createEmptyProductRow()]
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              
                <button
                  type="button"
                  className="enquiry-btn-secondary"
                  onClick={() => setForm((prev) => ({ ...prev, products: [...prev.products, createEmptyProductRow()] }))}
                >
                  Add Product
                </button>
              </div>
              <div>
                <label>Stage*</label>
                <select
                  value={form.stage}
                  onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value }))}
                >
                  {STAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                {form.stage === "SAMPLED" && (
                  <small style={{ color: "#7a4b09" }}>
                    You'll be reminded to follow up if this stays sampled for 12 days.
                  </small>
                )}
              </div>

              <div>
                <label>Priority</label>
                <label className="enquiry-urgent-check">
                  <input
                    type="checkbox"
                    checked={Boolean(form.is_urgent)}
                    onChange={(e) => setForm((p) => ({ ...p, is_urgent: e.target.checked }))}
                  />
                  <span>Mark as <strong>Urgent</strong></span>
                </label>
                {form.is_urgent && (
                  <small style={{ color: "#b42318" }}>
                    Skips approval — creates the order and production job right away, at the front of the queue.
                  </small>
                )}
              </div>

              <div>
                <label>Expected Timeline*</label>
                <input type="date" value={form.expected_timeline} onChange={(e) => setForm((p) => ({ ...p, expected_timeline: e.target.value }))} required />
              </div>
              <div>
                <label>Assigned To?</label>
                <SearchableSelect
                  options={masterData.assignedPersons}
                  value={form.assigned_person}
                  onChange={(value) => setForm((p) => ({ ...p, assigned_person: value }))}
                  placeholder="Select assignee"
                />
              </div>
              <div>
                <label>Status</label>
                <input value={editingEnquiryId ? (enquiries.find((item) => item.id === editingEnquiryId)?.status || "PENDING") : "PENDING"} disabled />
              </div>
              <div className="full-row">
                <label>Remarks</label>
                <textarea rows="3" value={form.notes_for_production} onChange={(e) => setForm((p) => ({ ...p, notes_for_production: e.target.value }))} />
              </div>
              <div className="full-row enquiry-form-actions">
                <button
                  type="button"
                  className="enquiry-btn-secondary"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="enquiry-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingEnquiryId ? "Save Changes" : "Create Enquiry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnquiryPage;
