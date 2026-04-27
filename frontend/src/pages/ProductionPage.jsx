import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { EditIcon, EyeIcon, FactoryIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { getDisplaySalesNumber } from "../utils/businessNumbers";

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
  if (status === "HOLD") return "hold";
  return "created";
}

function getStatusLabel(status) {
  if (status === "PENDING") return "Not Started";
  if (status === "IN_PROGRESS") return "Started";
  if (status === "HOLD") return "Hold";
  if (status === "COMPLETED") return "Completed";
  return "Created";
}

function getLatestDispatchDate(order) {
  const dispatches = order?.dispatches || [];
  if (!dispatches.length) return null;
  const sorted = [...dispatches].sort((a, b) => new Date(b.dispatchDate) - new Date(a.dispatchDate));
  return sorted[0]?.dispatchDate || null;
}

function getOrderDispatchDate(order) {
  const convertedFromEnquiry = String(order?.remarks || "").toLowerCase().includes("created from approved enquiry");
  return order?.dispatchDate || getLatestDispatchDate(order) || (convertedFromEnquiry ? order?.deliveryDate : null);
}

function getOrderRemainingQuantity(order) {
  if (!order) return 0;

  const dispatchedQuantity = (order.dispatches || []).reduce(
    (sum, item) => sum + Number(item.dispatchedQuantity || 0),
    0
  );

  return Math.max(Number(order.quantity || 0) - dispatchedQuantity, 0);
}

function normalizeCustomerName(value) {
  return String(value || "").trim().toLowerCase();
}

function ProductionPage() {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [productionRecords, setProductionRecords] = useState([]);
  const [form, setForm] = useState({
    delivery_date: "",
    capacity: "",
    remarks: "",
    status: "PENDING",
    state: ""
  });
  const tableWrapRef = useRef(null);
  const customerMasterRows = useMemo(
    () => (Array.isArray(masterData.customerMaster) ? masterData.customerMaster : []),
    [masterData.customerMaster]
  );
  const customerMasterMap = useMemo(() => {
    const map = new Map();
    customerMasterRows.forEach((row) => {
      const key = normalizeCustomerName(row.customerName);
      if (key) {
        map.set(key, row);
      }
    });
    return map;
  }, [customerMasterRows]);
  const getOrderLocation = (order) => {
    const matchedCustomer = customerMasterMap.get(normalizeCustomerName(order?.clientName));
    return {
      city: matchedCustomer?.city || order?.city || "",
      pincode: matchedCustomer?.pincode || order?.pincode || "",
      state: matchedCustomer?.state || order?.state || "",
      countryCode: matchedCustomer?.countryCode || order?.countryCode || ""
    };
  };
  const productionStatusOptions = useMemo(
    () => masterData.productionStatuses,
    [masterData.productionStatuses]
  );
  const productionEditStatusOptions = useMemo(
    () => productionStatusOptions.filter((option) => option.value !== "COMPLETED"),
    [productionStatusOptions]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      ...masterData.productionStatuses
    ],
    [masterData.productionStatuses]
  );
  const canManageProduction = ["admin", "production"].includes(user?.role);

  const fetchData = async () => {
    setLoading(true);
    try {
      const productionRes = await api.get("/production", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          company: companyFilter || undefined,
          date: dateFilter || undefined,
          page: currentPage,
          limit: PAGE_SIZE
        }
      });
      const payload = productionRes.data;
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const pagination = payload?.pagination || null;
      setProductionRecords(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
    } catch (error) {
      logApiError(error, "Failed to load production data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [query, statusFilter, companyFilter, dateFilter, currentPage]);

  const sortedRecords = useMemo(() => {
    const sorted = [...productionRecords];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (record) => {
      if (key === "orderNo") return String(record.order?.orderNo || "").toLowerCase();
      if (key === "createdAt") return new Date(record.createdAt || record.order?.createdAt || 0).getTime();
      if (key === "salesOrderNumber") return String(getDisplaySalesNumber(record.order) || "").toLowerCase();
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
      if (key === "orderNo") {
        const ta = new Date(a.createdAt || a.order?.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || b.order?.createdAt || 0).getTime();
        if (ta < tb) return -1 * sign;
        if (ta > tb) return 1 * sign;
      }
      return 0;
    });
    return sorted;
  }, [productionRecords, sortConfig]);

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

  const submitProduction = async (event) => {
    event.preventDefault();
    if (!canManageProduction || !editingProductionId) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        delivery_date: form.delivery_date,
        remarks: form.remarks,
        status: form.status,
        state: form.state,
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
      setIsCreateModalOpen(false);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save production record");
    } finally {
      setSaving(false);
    }
  };

  const exportProduction = async () => {
    let exportSource = sortedRecords;
    try {
      const { data } = await api.get("/production", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          company: companyFilter || undefined,
          date: dateFilter || undefined,
          page: 1,
          limit: 0
        }
      });
      exportSource = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : sortedRecords;
    } catch {
      // Fall back to loaded page.
    }

    exportRowsToExcel(
      `production_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "clientCode", header: "Client Code" },
        { key: "orderNo", header: "Order No" },
        { key: "salesOrderNo", header: "Sales ID" },
        { key: "product", header: "Product" },
        { key: "gradeQty", header: "Grade / QUANTITY" },
        { key: "remainingQty", header: "Remaining QUANTITY" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedDeliveryDate", header: "Expected Delivery Date" },
        { key: "city", header: "City" },
        { key: "pincode", header: "Pincode" },
        { key: "state", header: "State" },
        { key: "countryCode", header: "Country Code" },
        { key: "status", header: "Status" },
        { key: "productionCompDate", header: "Production Completion Date" },
        { key: "dispatchDate", header: "Dispatch Date" },
        { key: "productionState", header: "Production State" }
      ],
      exportSource.map((record) => ({
        ...(function () {
          const location = getOrderLocation(record.order);
          return {
            city: location.city || "-",
            pincode: location.pincode || "-",
            state: location.state || "-",
            countryCode: location.countryCode || "-"
          };
        })(),
        clientCode: getClientCode(record.order?.clientName, record.order?.id),
        salesOrderNo: getDisplaySalesNumber(record.order) || "-",
        product: record.order?.product || record.order?.enquiry?.product || "-",
        gradeQty: `${record.order?.grade || "-"} / ${record.order?.quantity || "-"}`,
        remainingQty: getOrderRemainingQuantity(record.order),
        unit: record.order?.unit || "-",
        expectedDeliveryDate: formatDate(record.deliveryDate || record.order?.deliveryDate),
        status: getStatusLabel(record.status),
        productionCompDate: formatDate(record.productionCompletionDate),
        dispatchDate: formatDate(getOrderDispatchDate(record.order)),
        productionState: record.state || "-"
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
      <section className="production-card production-header-card">
        <h2>Production</h2>
        <div className="production-header-right">
          <div className="production-header-search">
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
          </div>
        </div>
      </section>

      <section className="production-card">
        <div className="production-toolbar">
          <div className="production-filter-grid">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label ?? option.value}</option>
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
          <div className="production-toolbar-actions">
            <button className="production-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
            <button className="production-btn-secondary" onClick={exportProduction}>Export to Excel</button>
          </div>
        </div>

        {loading ? (
          <div className="production-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="production-skeleton-row" />)}
          </div>
        ) : sortedRecords.length ? (
          <>
            <div className="production-table-wrap" ref={tableWrapRef}>
            <div className="production-table-meta">
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRecords)}-
              {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} records
            </div>
            <table className="production-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client Code</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("orderNo")}>Order No</button></th>
                  <th><button className="production-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales ID</button></th>
                  <th><button className="production-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                  <th>Grade / QUANTITY</th>
                  <th>Remaining QUANTITY</th>
                  <th>Unit of Measurement</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("deliveryDate")}>Expected Timeline</button></th>
                  <th>City</th>
                  <th>Pincode</th>
                  <th>State</th>
                  <th>Country Code</th>
                  <th><button className="production-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                  <th>Production Completion Date</th>
                  <th>Dispatch Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <VirtualizedTableBody
                rows={sortedRecords}
                colSpan={17}
                rowHeight={52}
                overscan={8}
                scrollContainerRef={tableWrapRef}
                getRowKey={(record) => record.id}
                renderRow={(record, index) => {
                  const location = getOrderLocation(record.order);
                  return (
                    <tr key={record.id}>
                      <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{getClientCode(record.order?.clientName, record.order?.id)}</td>
                      <td>{record.order?.orderNo || "-"}</td>
                      <td>{getDisplaySalesNumber(record.order) || "-"}</td>
                      <td>{record.order?.product || record.order?.enquiry?.product || "-"}</td>
                      <td>{record.order?.grade || "-"} / {record.order?.quantity || "-"}</td>
                      <td>{getOrderRemainingQuantity(record.order)}</td>
                      <td>{record.order?.unit || "-"}</td>
                      <td>{formatDate(record.deliveryDate || record.order?.deliveryDate)}</td>
                      <td>{location.city || "-"}</td>
                      <td>{location.pincode || "-"}</td>
                      <td>{location.state || "-"}</td>
                      <td>{location.countryCode || "-"}</td>
                      <td>
                        <span className={`production-status ${getStatusBadgeClass(record.status)}`}>
                          {getStatusLabel(record.status)}
                        </span>
                      </td>
                      <td>{formatDate(record.productionCompletionDate)}</td>
                      <td>{formatDate(getOrderDispatchDate(record.order))}</td>
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
                              <button className="production-btn-primary" onClick={() => completeProduction(record.id)}>Complete</button>
                            ) : (
                              <button className="production-btn-secondary" disabled>Completed</button>
                            )
                          )}
                          {canManageProduction && <button className="production-link-btn delete" onClick={() => removeProduction(record.id)}><TrashIcon /></button>}
                        </div>
                      </td>
                    </tr>
                  );
                }}
              />
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
              {(() => {
                const location = getOrderLocation(selectedRecord.order);
                return (
                  <>
              <p><span>Client Code:</span> {getClientCode(selectedRecord.order?.clientName, selectedRecord.order?.id)}</p>
              <p><span>Sales ID:</span> {getDisplaySalesNumber(selectedRecord.order) || "-"}</p>
              <p><span>Product:</span> {selectedRecord.order?.product || selectedRecord.order?.enquiry?.product || "-"}</p>
              <p><span>Grade / QUANTITY:</span> {selectedRecord.order?.grade || "-"} / {selectedRecord.order?.quantity || "-"}</p>
              <p><span>Remaining QUANTITY:</span> {getOrderRemainingQuantity(selectedRecord.order)}</p>
              <p><span>Unit of Measurement:</span> {selectedRecord.order?.unit || "-"}</p>
              <p><span>Expected Delivery Date:</span> {formatDate(selectedRecord.deliveryDate || selectedRecord.order?.deliveryDate)}</p>
              <p><span>City:</span> {location.city || "-"}</p>
              <p><span>Pincode:</span> {location.pincode || "-"}</p>
              <p><span>State:</span> {location.state || "-"}</p>
              <p><span>Country Code:</span> {location.countryCode || "-"}</p>
              <p><span>Status:</span> {getStatusLabel(selectedRecord.status)}</p>
              <p><span>Production Completion Date:</span> {formatDate(selectedRecord.productionCompletionDate)}</p>
              <p><span>Dispatch Date:</span> {formatDate(getOrderDispatchDate(selectedRecord.order))}</p>
              <p><span>Production State:</span> {selectedRecord.state || "-"}</p>
              <p><span>Assigned Team/User:</span> {selectedRecord.assignedPersonnel}</p>
                  </>
                );
              })()}
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
                }}
                disabled={saving}
              >
                Close
              </button>
            </div>

            <form className="production-form-grid" onSubmit={submitProduction}>
              <div>
                <label>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                  {productionEditStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label ?? option.value}</option>
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
