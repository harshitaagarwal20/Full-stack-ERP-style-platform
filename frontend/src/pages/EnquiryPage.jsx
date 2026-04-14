import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import { EditIcon, EyeIcon, InboxIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";

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
  const [enquiries, setEnquiries] = useState([]);
  const [form, setForm] = useState({
    enquiry_date: "",
    mode_of_enquiry: "",
    company_name: "",
    product: "",
    quantity: "",
    unit_of_measurement: "",
    expected_timeline: "",
    assigned_person: "",
    notes_for_production: ""
  });
  const canManageEnquiries = user?.role === "admin" || user?.role === "sales";
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

  const fetchEnquiries = async (searchQuery = query, status = statusFilter) => {
    setLoading(true);
    try {
      const { data } = await api.get("/enquiries", {
        params: {
          q: searchQuery || undefined,
          status: status === "all" ? undefined : status
        }
      });
      setEnquiries(data || []);
    } catch (error) {
      logApiError(error, "Failed to fetch enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries("", "all");
  }, []);

  const filteredEnquiries = useMemo(() => {
    return enquiries.filter((item) => {
      const matchesAssigned = assignedFilter
        ? (item.assignedPerson || "").toLowerCase().includes(assignedFilter.toLowerCase())
        : true;
      const targetDate = item.expectedTimeline ? new Date(item.expectedTimeline) : null;
      const normalizedDate = targetDate && !Number.isNaN(targetDate.getTime()) ? targetDate.toISOString().slice(0, 10) : "";
      const matchesDate = dateFilter ? normalizedDate === dateFilter : true;
      return matchesAssigned && matchesDate;
    });
  }, [enquiries, assignedFilter, dateFilter]);

  const pendingCount = useMemo(
    () => enquiries.filter((item) => item.status === "PENDING").length,
    [enquiries]
  );

  const sortedEnquiries = useMemo(() => {
    const sorted = [...filteredEnquiries];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (item) => {
      if (key === "id") return Number(item.id || 0);
      if (key === "enquiryDate") return new Date(item.enquiryDate || 0).getTime();
      if (key === "companyName") return String(item.companyName || "").toLowerCase();
      if (key === "product") return String(item.product || "").toLowerCase();
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
  }, [filteredEnquiries, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedEnquiries.length / PAGE_SIZE));

  const paginatedEnquiries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedEnquiries.slice(start, start + PAGE_SIZE);
  }, [sortedEnquiries, currentPage]);

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
    fetchEnquiries(nextQuery, statusFilter);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canManageEnquiries) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        mode_of_enquiry: form.mode_of_enquiry || null,
        unit_of_measurement: form.unit_of_measurement || null,
        notes_for_production: form.notes_for_production || null
      };

      if (editingEnquiryId) {
        await api.put(`/enquiries/${editingEnquiryId}/edit`, payload);
      } else {
        await api.post("/enquiries", payload);
      }
      setForm({
        enquiry_date: "",
        mode_of_enquiry: "",
        company_name: "",
        product: "",
        quantity: "",
        unit_of_measurement: "",
        expected_timeline: "",
        assigned_person: "",
        notes_for_production: ""
      });
      setEditingEnquiryId(null);
      setIsCreateModalOpen(false);
      await fetchEnquiries();
    } catch (error) {
      logApiError(error, "Failed to save enquiry");
    } finally {
      setSaving(false);
    }
  };

  const exportEnquiries = () => {
    exportRowsToExcel(
      `enquiries_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "id", header: "ID" },
        { key: "enquiryDate", header: "Enquiry Date" },
        { key: "modeOfEnquiry", header: "Mode of Enquiry" },
        { key: "companyName", header: "Company" },
        { key: "product", header: "Product" },
        { key: "quantity", header: "Quantity" },
        { key: "unitOfMeasurement", header: "Unit of Measurement" },
        { key: "expectedTimeline", header: "Expected Timeline" },
        { key: "assignedPerson", header: "Assigned User" },
        { key: "notesForProduction", header: "Notes for Production Team" },
        { key: "status", header: "Status" }
      ],
      filteredEnquiries.map((item) => ({
        ...item,
        enquiryDate: formatDate(item.enquiryDate),
        modeOfEnquiry: item.modeOfEnquiry || "-",
        unitOfMeasurement: item.unitOfMeasurement || "-",
        expectedTimeline: formatDate(item.expectedTimeline),
        notesForProduction: item.notesForProduction || "-"
      }))
    );
  };

  const onEdit = (enquiry) => {
    setEditingEnquiryId(enquiry.id);
    setForm({
      enquiry_date: toDateInput(enquiry.enquiryDate),
      mode_of_enquiry: enquiry.modeOfEnquiry || "",
      company_name: enquiry.companyName || "",
      product: enquiry.product || "",
      quantity: enquiry.quantity ? String(enquiry.quantity) : "",
      unit_of_measurement: enquiry.unitOfMeasurement || "",
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
          <h2>Enquiry Module</h2>
        </div>
        <div className="enquiry-header-actions">
          <span className="enquiry-pending-badge">Pending: {pendingCount}</span>
          {canManageEnquiries && (
            <button
              className="enquiry-btn-primary"
              onClick={() => {
                setEditingEnquiryId(null);
                setForm({
                  enquiry_date: "",
                  mode_of_enquiry: "",
                  company_name: "",
                  product: "",
                  quantity: "",
                  unit_of_measurement: "",
                  expected_timeline: "",
                  assigned_person: "",
                  notes_for_production: ""
                });
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
        ) : filteredEnquiries.length ? (
          <>
            <div className="enquiry-table-wrap">
              <div className="enquiry-table-meta">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, sortedEnquiries.length)}-
                {Math.min(currentPage * PAGE_SIZE, sortedEnquiries.length)} of {sortedEnquiries.length} records
              </div>
              <table className="enquiry-table">
                <thead>
                  <tr>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("id")}>ID</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("enquiryDate")}>Enquiry Date</button></th>
                    <th>Mode of Enquiry</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("companyName")}>Company</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("quantity")}>Quantity</button></th>
                    <th>Unit of Measurement</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("expectedTimeline")}>Expected Timeline</button></th>
                    <th>Assigned To</th>
                    <th>Notes for Production Team</th>
                    <th><button className="enquiry-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEnquiries.map((enquiry) => (
                    <tr key={enquiry.id}>
                      <td>{enquiry.id}</td>
                      <td>{formatDate(enquiry.enquiryDate)}</td>
                      <td>{enquiry.modeOfEnquiry || "-"}</td>
                      <td>{enquiry.companyName}</td>
                      <td>{enquiry.product}</td>
                      <td>{enquiry.quantity}</td>
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
                  ))}
                </tbody>
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
                setForm({
                  enquiry_date: "",
                  mode_of_enquiry: "",
                  company_name: "",
                    product: "",
                    quantity: "",
                    expected_timeline: "",
                    assigned_person: "",
                    notes_for_production: ""
                  });
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
                <p>#{selectedEnquiry.id} - {selectedEnquiry.companyName}</p>
              </div>
              <button className="enquiry-modal-close-btn" onClick={() => setSelectedEnquiry(null)}>Close</button>
            </div>
            <div className="enquiry-detail-grid">
              <p><span>Enquiry Date:</span> {formatDate(selectedEnquiry.enquiryDate)}</p>
              <p><span>Mode of Enquiry:</span> {selectedEnquiry.modeOfEnquiry || "-"}</p>
              <p><span>Product:</span> {selectedEnquiry.product}</p>
              <p><span>Quantity:</span> {selectedEnquiry.quantity}</p>
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
                <select value={form.company_name} onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))} required>
                  <option value="">Select company</option>
                  {masterData.companyNames.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Product Enquired*</label>
                <select value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} required>
                  <option value="">Select product</option>
                  {masterData.products.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Quantity</label>
                <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required />
              </div>
              <div>
                <label>Unit of Measurement</label>
                <input value={form.unit_of_measurement} onChange={(e) => setForm((p) => ({ ...p, unit_of_measurement: e.target.value }))} />
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
                <label>Remarks*</label>
                <textarea rows="3" value={form.notes_for_production} onChange={(e) => setForm((p) => ({ ...p, notes_for_production: e.target.value }))} required />
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
