import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import ProductionMobileModule from "../components/mobile/modules/ProductionMobileModule";
import { EditIcon, EyeIcon, FactoryIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useIsMobile from "../hooks/useIsMobile";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function getClientCode(clientName, orderId) {
  const normalizedName = (clientName || "").toUpperCase().replace(/[^A-Z]/g, "");
  const prefix = (normalizedName.slice(0, 2) || "CL").padEnd(2, "X");
  const numericOrderId = Number(orderId);
  const suffix = Number.isFinite(numericOrderId) && numericOrderId > 0
    ? String(numericOrderId).padStart(3, "0")
    : "000";
  return `${prefix}${suffix}`;
}

function getStatusBadgeClass(status) {
  if (status === "PENDING") return "pending";
  if (status === "COMPLETED") return "completed";
  if (status === "IN_PROGRESS") return "in-progress";
  return "created";
}

function getStatusLabel(status) {
  if (status === "PENDING") return "Pending";
  if (status === "IN_PROGRESS") return "In Progress";
  if (status === "COMPLETED") return "Completed";
  return "Created";
}

function getLatestDispatchDate(order) {
  const dispatches = order?.dispatches || [];
  if (!dispatches.length) return null;
  const sorted = [...dispatches].sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate));
  return sorted[0]?.dispatchDate || null;
}

function getOrderExportDate(order) {
  const convertedFromEnquiry = String(order?.remarks || "").toLowerCase().includes("created from approved enquiry");
  return order?.exportDate || getLatestDispatchDate(order) || (convertedFromEnquiry ? order?.deliveryDate : null);
}

function ProductionPage() {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const masterData = useMasterData();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "deliveryDate", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [productionRecords, setProductionRecords] = useState([]);
  const [form, setForm] = useState({
    delivery_date: "",
    capacity: "",
    remarks: "",
    status: "PENDING",
    state: ""
  });
  const productionStatusOptions = useMemo(
    () => masterData.productionStatuses,
    [masterData.productionStatuses]
  );
  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      ...masterData.productionStatuses
    ],
    [masterData.productionStatuses]
  );
  const canManageProduction = ["admin", "production"].includes(user?.role);

  if (isMobile) {
    return <ProductionMobileModule canManage={canManageProduction} />;
  }

  const fetchData = async (searchQuery = query) => {
    setLoading(true);
    try {
      const productionRes = await api.get("/production", { params: { q: searchQuery || undefined } });
      setProductionRecords(productionRes.data || []);
    } catch (error) {
      logApiError(error, "Failed to load production data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("");
  }, []);

  const filteredRecords = useMemo(() => {
    return productionRecords.filter((record) => {
      const matchesStatus = statusFilter === "all" ? true : record.status === statusFilter;
      const company = record.order?.enquiry?.companyName || "";
      const matchesCompany = companyFilter ? company.toLowerCase().includes(companyFilter.toLowerCase()) : true;
      const matchesDate = dateFilter
        ? new Date(record.deliveryDate).toISOString().slice(0, 10) === dateFilter
        : true;
      return matchesStatus && matchesCompany && matchesDate;
    });
  }, [productionRecords, statusFilter, companyFilter, dateFilter]);

  const sortedRecords = useMemo(() => {
    const sorted = [...filteredRecords];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (record) => {
      if (key === "salesOrderNumber") return String(record.order?.salesOrderNumber || "").toLowerCase();
      if (key === "product") return String(record.order?.product || record.order?.enquiry?.product || "").toLowerCase();
      if (key === "quantity") return Number(record.order?.quantity || 0);
      if (key === "deliveryDate") return new Date(record.deliveryDate || record.order?.deliveryDate || 0).getTime();
      if (key === "status") return String(record.status || "").toLowerCase();
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
  }, [filteredRecords, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedRecords.slice(start, start + PAGE_SIZE);
  }, [sortedRecords, currentPage]);

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
    fetchData(nextQuery);
  };

  const submitProduction = async (event) => {
    event.preventDefault();
    if (!canManageProduction || !editingProductionId) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: form.capacity ? Number(form.capacity) : undefined
      };

      await api.put(`/production/${editingProductionId}/edit`, payload);
      setForm({
        delivery_date: "",
        capacity: "",
        remarks: "",
        status: "PENDING",
        state: ""
      });
      setEditingProductionId(null);
      setEditingRecord(null);
      setIsCreateModalOpen(false);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save production record");
    } finally {
      setSaving(false);
    }
  };

  const exportProduction = () => {
    exportRowsToExcel(
      `production_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "clientCode", header: "Client Code" },
        { key: "salesOrderNo", header: "Sales Order No" },
        { key: "product", header: "Product" },
        { key: "gradeQty", header: "Grade / QTY" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedDeliveryDate", header: "Expected Delivery Date" },
        { key: "city", header: "City" },
        { key: "countryCode", header: "Country Code" },
        { key: "status", header: "Status" },
        { key: "productionCompDate", header: "Production Completion Date" },
        { key: "dateOfExport", header: "Date of Export" },
        { key: "state", header: "State" }
      ],
      filteredRecords.map((record) => ({
        clientCode: getClientCode(record.order?.clientName, record.order?.id),
        salesOrderNo: record.order?.salesOrderNumber || "-",
        product: record.order?.product || record.order?.enquiry?.product || "-",
        gradeQty: `${record.order?.grade || "-"} / ${record.order?.quantity || "-"}`,
        unit: record.order?.unit || "-",
        expectedDeliveryDate: formatDate(record.deliveryDate || record.order?.deliveryDate),
        city: record.order?.city || "-",
        countryCode: record.order?.countryCode || "-",
        status: getStatusLabel(record.status),
        productionCompDate: formatDate(record.productionCompletionDate),
        dateOfExport: formatDate(getOrderExportDate(record.order)),
        state: record.state || "-"
      }))
    );
  };

  const completeProduction = async (id) => {
    if (!canManageProduction) return;
    try {
      await api.put(`/production/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to complete production");
    }
  };

  const editProduction = (record) => {
    if (!canManageProduction) return;
    setEditingProductionId(record.id);
    setEditingRecord(record);
    setForm({
      delivery_date: record.deliveryDate ? new Date(record.deliveryDate).toISOString().slice(0, 10) : "",
      capacity: record.capacity ? String(record.capacity) : "",
      remarks: record.remarks || "",
      status: record.status || "PENDING",
      state: record.state || ""
    });
    setIsCreateModalOpen(true);
  };

  const removeProduction = async (id) => {
    if (!canManageProduction) return;
    if (!window.confirm("Delete this production record?")) return;
    try {
      await api.delete(`/production/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to delete production record");
    }
  };

  return (
    <div className="production-page">
      <section className="production-card production-search-card">
        <div className="production-search-wrap">
          <SearchIcon />
          <input
            className="production-search-input"
            placeholder="Search order, product, company, or assigned team"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchSubmit();
            }}
          />
          <button className="production-btn-primary" onClick={onSearchSubmit}>Search</button>
        </div>

        <div className="production-filter-grid">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Filter by company"
            value={companyFilter}
            onChange={(event) => { setCompanyFilter(event.target.value); setCurrentPage(1); }}
          />
          <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} />
        </div>
      </section>

      <section className="production-card">
        <div className="production-section-head">
          <h2>Production Module (Auto-Generated)</h2>
          <button className="production-btn-secondary" onClick={exportProduction}>Export to Excel</button>
        </div>

        {loading ? (
          <div className="production-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="production-skeleton-row" />)}
          </div>
        ) : filteredRecords.length ? (
          <>
            <div className="production-table-wrap">
            <div className="production-table-meta">
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, sortedRecords.length)}-
              {Math.min(currentPage * PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length} records
            </div>
            <table className="production-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client Code</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales Order No</button></th>
                  <th><button className="production-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                  <th>Grade / QTY</th>
                  <th>Unit of Measurement</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("deliveryDate")}>Expected Timeline</button></th>
                  <th>City</th>
                  <th>Country Code</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                  <th>Production Completion Date</th>
                  <th>Date of Export</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record, index) => (
                  <tr key={record.id}>
                    <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                    <td>{getClientCode(record.order?.clientName, record.order?.id)}</td>
                    <td>{record.order?.salesOrderNumber || "-"}</td>
                    <td>{record.order?.product || record.order?.enquiry?.product || "-"}</td>
                    <td>{record.order?.grade || "-"} / {record.order?.quantity || "-"}</td>
                    <td>{record.order?.unit || "-"}</td>
                    <td>{formatDate(record.deliveryDate || record.order?.deliveryDate)}</td>
                    <td>{record.order?.city || "-"}</td>
                    <td>{record.order?.countryCode || "-"}</td>
                    <td>
                      <span className={`production-status ${getStatusBadgeClass(record.status)}`}>
                        {getStatusLabel(record.status)}
                      </span>
                    </td>
                    <td>{formatDate(record.productionCompletionDate)}</td>
                    <td>{formatDate(getOrderExportDate(record.order))}</td>
                    <td>
                      <div className="production-actions">
                        <button className="icon-btn" onClick={() => setSelectedRecord(record)} aria-label="View production record" title="View production record">
                          <EyeIcon />
                        </button>
                        {canManageProduction && (
                          <button className="icon-btn" onClick={() => editProduction(record)} aria-label="Edit production record" title="Edit production record">
                            <EditIcon />
                          </button>
                        )}
                        {canManageProduction && (
                          record.status !== "COMPLETED" ? (
                            <button className="production-link-btn update" onClick={() => completeProduction(record.id)}>Complete</button>
                          ) : (
                            <button className="production-link-btn disabled" disabled>Completed</button>
                          )
                        )}
                        {canManageProduction && <button className="production-link-btn delete" onClick={() => removeProduction(record.id)}><TrashIcon /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="production-pagination">
              <div className="production-pagination-info">Page {currentPage} of {totalPages}</div>
              <div className="production-page-controls">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          </div>
          </>
        ) : (
          <div className="production-empty-state">
            <div className="production-empty-icon"><FactoryIcon /></div>
            <p>No production records yet. Start production from Orders module.</p>
          </div>
        )}
      </section>

      {selectedRecord && (
        <div className="production-modal-overlay">
          <div className="production-modal-card">
            <div className="production-modal-head">
              <div>
                <h3>Production Record Details</h3>
                <p>{selectedRecord.order?.orderNo} - {selectedRecord.order?.enquiry?.companyName}</p>
              </div>
              <button className="production-modal-close" onClick={() => setSelectedRecord(null)}>Close</button>
            </div>

            <div className="production-detail-grid">
              <p><span>Client Code:</span> {getClientCode(selectedRecord.order?.clientName, selectedRecord.order?.id)}</p>
              <p><span>Sales Order No:</span> {selectedRecord.order?.salesOrderNumber || "-"}</p>
              <p><span>Product:</span> {selectedRecord.order?.product || selectedRecord.order?.enquiry?.product || "-"}</p>
              <p><span>Grade / QTY:</span> {selectedRecord.order?.grade || "-"} / {selectedRecord.order?.quantity || "-"}</p>
              <p><span>Unit of Measurement:</span> {selectedRecord.order?.unit || "-"}</p>
              <p><span>Expected Delivery Date:</span> {formatDate(selectedRecord.deliveryDate || selectedRecord.order?.deliveryDate)}</p>
              <p><span>City:</span> {selectedRecord.order?.city || "-"}</p>
              <p><span>Country Code:</span> {selectedRecord.order?.countryCode || "-"}</p>
              <p><span>Status:</span> {getStatusLabel(selectedRecord.status)}</p>
              <p><span>Production Completion Date:</span> {formatDate(selectedRecord.productionCompletionDate)}</p>
              <p><span>Date of Export:</span> {formatDate(getOrderExportDate(selectedRecord.order))}</p>
              <p><span>State:</span> {selectedRecord.state || "-"}</p>
              <p><span>Assigned Team/User:</span> {selectedRecord.assignedPersonnel}</p>
            </div>
            {canManageProduction && (
              <div className="production-form-actions">
                <button
                  className="production-btn-secondary"
                  onClick={() => {
                    setSelectedRecord(null);
                    editProduction(selectedRecord);
                  }}
                >
                  Edit
                </button>
                <button className="production-btn-primary" onClick={() => setSelectedRecord(null)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isCreateModalOpen && editingProductionId && canManageProduction && (
        <div className="production-modal-overlay">
          <div className="production-modal-card large">
            <div className="production-modal-head">
              <div>
                <h3>Edit Production</h3>
                <p>Edit production entry details and status.</p>
              </div>
              <button
                className="production-modal-close"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProductionId(null);
                    setEditingRecord(null);
                  }}
                  disabled={saving}
                >
                  Close
              </button>
            </div>

            <form className="production-form-grid" onSubmit={submitProduction}>
              {editingRecord && (
                <div className="full-row production-detail-grid">
                  <p><span>Client Code:</span> {getClientCode(editingRecord.order?.clientName, editingRecord.order?.id)}</p>
                  <p><span>Sales Order No:</span> {editingRecord.order?.salesOrderNumber || "-"}</p>
                  <p><span>Product:</span> {editingRecord.order?.product || editingRecord.order?.enquiry?.product || "-"}</p>
                  <p><span>Grade / QTY:</span> {editingRecord.order?.grade || "-"} / {editingRecord.order?.quantity || "-"}</p>
                  <p><span>Unit of Measurement:</span> {editingRecord.order?.unit || "-"}</p>
                  <p><span>Expected Timeline:</span> {formatDate(editingRecord.deliveryDate || editingRecord.order?.deliveryDate)}</p>
                  <p><span>City:</span> {editingRecord.order?.city || "-"}</p>
                  <p><span>Country Code:</span> {editingRecord.order?.countryCode || "-"}</p>
                  <p><span>Status:</span> {getStatusLabel(editingRecord.status)}</p>
                  <p><span>Production Completion Date:</span> {formatDate(editingRecord.productionCompletionDate)}</p>
                  <p><span>Date of Export:</span> {formatDate(getOrderExportDate(editingRecord.order))}</p>
                  <p><span>State:</span> {editingRecord.state || "-"}</p>
                </div>
              )}
              <div>
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {productionStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Expected Delivery Date</label>
                <input type="date" value={form.delivery_date} onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))} required />
              </div>
              <div>
                <label>Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} required />
              </div>
              <div>
                <label>State</label>
                <input type="text" placeholder="Enter production state" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
              </div>
              <div className="full-row">
                <label>Remarks</label>
                <textarea rows="2" value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
              </div>
              <div className="full-row production-form-actions">
                <button
                  type="button"
                  className="production-btn-secondary"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProductionId(null);
                    setEditingRecord(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="production-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductionPage;
