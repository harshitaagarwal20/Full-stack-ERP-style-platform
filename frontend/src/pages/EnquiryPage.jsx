import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { EditIcon, EyeIcon, InboxIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { CURRENCY_OPTIONS, formatPriceValue } from "../utils/commerce";
import { getDisplayEnquiryNumber } from "../utils/businessNumbers";
import { formatEnquiryProducts, normalizeEnquiryProductRows } from "../utils/enquiryProducts";

function prettyLabel(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
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
  if (status === "HOLD") return "pending";
  if (status === "PENDING") return "pending";
  return "new";
}

function createEmptyForm() {
  return {
    enquiry_date: "",
    mode_of_enquiry: "",
    company_name: "",
    price: "",
    currency: "INR",
    product: "",
    products: [createEmptyProductRow()],
    expected_timeline: "",
    assigned_person: "",
    notes_for_production: ""
  };
}

function createEmptyProductRow() {
  return { product: "", grade: "", quantity: "", unit_of_measurement: "" };
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
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [enquiries, setEnquiries] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false);
  const companyDropdownRef = useRef(null);
  const canManageEnquiries = user?.role === "admin" || user?.role === "sales";
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
  const filteredCompanyOptions = useMemo(() => {
    const inputValue = String(form.company_name || "").trim().toLowerCase();
    if (!inputValue) return companyOptions;
    return companyOptions.filter((option) =>
      String(option.label || option.value || "").toLowerCase().includes(inputValue)
    );
  }, [companyOptions, form.company_name]);
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

  useEffect(() => {
    const onOutsideClick = (event) => {
      if (!companyDropdownRef.current?.contains(event.target)) {
        setIsCompanyDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

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

    const invalidRow = productRows.find((row) => !row.quantity || !row.unit_of_measurement);
    if (invalidRow) {
      window.alert("Fill product, grade, quantity, and unit of measurement for each row.");
      return;
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
        unit_of_measurement: unitOfMeasurement,
        notes_for_production: form.notes_for_production || null
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
      price: enquiry.price ?? "",
      currency: enquiry.currency || "",
      product: enquiry.product || "",
      products: enquiryProducts.length ? enquiryProducts : [createEmptyProductRow()],
      expected_timeline: toDateInput(enquiry.expectedTimeline),
      assigned_person: enquiry.assignedPerson || "",
      notes_for_production: enquiry.notesForProduction || ""
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
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} />
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
                <label>Mode of Enquiry</label>
                <select value={form.mode_of_enquiry} onChange={(e) => setForm((p) => ({ ...p, mode_of_enquiry: e.target.value }))}>
                  <option value="">Select mode</option>
                  {masterData.modeOfEnquiry.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Company Name*</label>
                <div className="enquiry-company-select" ref={companyDropdownRef}>
                  <input
                    type="text"
                    value={form.company_name}
                    placeholder="Search or select company"
                    onFocus={() => setIsCompanyDropdownOpen(true)}
                    onChange={(e) => {
                      setForm((p) => ({ ...p, company_name: e.target.value }));
                      setIsCompanyDropdownOpen(true);
                    }}
                    required
                  />
                  {isCompanyDropdownOpen && (
                    <div className="enquiry-company-select-menu">
                      {filteredCompanyOptions.length ? (
                        filteredCompanyOptions.map((option) => (
                          <button
                            type="button"
                            key={option.value}
                            className="enquiry-company-select-item"
                            onClick={() => {
                              setForm((p) => ({ ...p, company_name: option.value }));
                              setIsCompanyDropdownOpen(false);
                            }}
                          >
                            {option.label}
                          </button>
                        ))
                      ) : (
                        <div className="enquiry-company-select-empty">No matching company found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label>Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  placeholder="Enter price"
                />
              </div>
              <div>
                <label>Currency</label>
                <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                  <option value="">Select currency</option>
                  {CURRENCY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="full-row">
                <label>Products Enquired*</label>
                <div className="enquiry-product-rows">
                  {(form.products || []).map((row, index) => (
                    <div key={index} className="enquiry-product-row">
                      <div>
                        <label>Product</label>
                        <select
                          value={row.product}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, product: e.target.value } : item
                              )
                            }))
                          }
                          required
                        >
                          <option value="">Select product</option>
                          {masterData.products.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label>Grade</label>
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
                        <select
                          value={row.unit_of_measurement}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              products: prev.products.map((item, rowIndex) =>
                                rowIndex === index ? { ...item, unit_of_measurement: e.target.value } : item
                              )
                            }))
                          }
                        >
                          <option value="">Select unit</option>
                          {UNIT_OPTIONS.map((unit) => (
                            <option key={unit} value={unit}>{unit}</option>
                          ))}
                        </select>
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
                <label>Expected Timeline*</label>
                <input type="date" value={form.expected_timeline} onChange={(e) => setForm((p) => ({ ...p, expected_timeline: e.target.value }))} required />
              </div>
              <div>
                <label>Assigned To?</label>
                <select value={form.assigned_person} onChange={(e) => setForm((p) => ({ ...p, assigned_person: e.target.value }))} required>
                  <option value="">Select assignee</option>
                  {masterData.assignedPersons.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
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
