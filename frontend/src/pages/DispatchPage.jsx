import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { EditIcon, SearchIcon, TrashIcon, TruckIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { getDisplaySalesNumber } from "../utils/businessNumbers";
import { getDispatchSortPriority } from "../utils/dispatchOrdering";

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function mapShipmentStatus(status) {
  if (status === "PACKED") return { label: "Pending", className: "pending" };
  if (status === "SHIPPED") return { label: "Dispatched", className: "in-transit" };
  if (status === "DELIVERED") return { label: "Delivered", className: "delivered" };
  return { label: status || "Pending", className: "pending" };
}

function getOrderRemainingQuantity(order, dispatch) {
  if (!order) return 0;
  if (dispatch) {
    return Math.max(
      (order.quantity || 0) - ((order.dispatches || []).reduce((sum, item) => sum + (item.dispatchedQuantity || 0), 0)),
      0
    );
  }
  return order.remainingQuantity ?? order.quantity ?? 0;
}

function getDispatchRowStatus(row) {
  const order = row.order || {};
  const dispatch = row.dispatch;

  if (!dispatch) {
    return { label: "Pending", className: "pending" };
  }

  const remainingQuantity = getOrderRemainingQuantity(order, dispatch);

  if (remainingQuantity > 0) {
    return { label: "Partially Dispatched", className: "partial" };
  }

  return mapShipmentStatus(dispatch.shipmentStatus);
}

function getAllowedShipmentStatusOptions(order, dispatchQty, editingShipmentStatus = "") {
  const baseOptions = [
    { value: "PACKING", label: "Pending" },
    { value: "SHIPPED", label: "Dispatched" }
  ];

  const remainingQuantity = getOrderRemainingQuantity(order, null);
  const canDeliver = Number(dispatchQty) > 0 && Number(dispatchQty) === Number(remainingQuantity);
  if (canDeliver || String(editingShipmentStatus || "").toUpperCase() === "DELIVERED") {
    baseOptions.push({ value: "DELIVERED", label: "Delivered" });
  }

  return baseOptions;
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

function toExportRow(row) {
  const order = row.order || {};
  const dispatch = row.dispatch;
  const dispatchQuantity = dispatch?.dispatchedQuantity || 0;
  const remainingQuantity = getOrderRemainingQuantity(order, dispatch);

  return {
    clientCode: getClientCode(order.clientName, order.id),
    packagingSize: order.packingSize || "-",
    salesOrderNo: getDisplaySalesNumber(order) || "-",
    product: order.product || "-",
    orderQuantity: order.quantity || 0,
    dispatchQuantity,
    remainingQuantity,
    unit: order.unit || "-",
    expectedDeliveryDate: formatDate(order.deliveryDate),
    city: order.city || "-",
    pincode: order.pincode || "-",
    state: order.state || "-",
    countryCode: order.countryCode || "-",
    dispatchDate: dispatch ? formatDate(dispatch.dispatchDate) : "-",
    status: getDispatchRowStatus(row).label,
    prodCompDate: formatDate(order.production?.productionCompletionDate)
  };
}

function DispatchPage() {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDispatchId, setEditingDispatchId] = useState(null);
  const [dispatchRows, setDispatchRows] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_quantity: "",
    dispatch_date: "",
    shipment_status: "",
    packing_done: false,
    remarks: ""
  });
  const tableWrapRef = useRef(null);
  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      { value: "pending", label: "Pending" },
      ...masterData.shipmentStatuses
        .filter((item) => item.value !== "PACKED")
        .map((item) => ({
          value: item.value.toLowerCase(),
          label: item.label
        }))
    ],
    [masterData.shipmentStatuses]
  );
  const canManageDispatch = ["admin", "dispatch"].includes(user?.role);
  const shipmentStatusOptions = useMemo(() => {
    const dispatchQty = Number(dispatchForm.dispatch_quantity || 0);
    return getAllowedShipmentStatusOptions(selectedOrder, dispatchQty, dispatchForm.shipment_status);
  }, [dispatchForm.dispatch_quantity, dispatchForm.shipment_status, selectedOrder]);

  const fetchDispatchData = async ({
    searchQuery = query,
    page = currentPage,
    status = statusFilter,
    client = clientFilter,
    date = dateFilter
  } = {}) => {
    setLoading(true);
    try {
      const { data } = await api.get("/dispatch", {
        params: {
          paginated: 1,
          q: searchQuery || undefined,
          status: status === "all" ? undefined : status,
          client: client || undefined,
          date: date || undefined,
          page,
          limit: PAGE_SIZE
        }
      });
      const nextItems = Array.isArray(data?.items) ? data.items : [];
      const pagination = data?.pagination || {};
      setDispatchRows(nextItems);
      setTotalPages(Math.max(1, Number(pagination.totalPages) || 1));
      setTotalRecords(Math.max(0, Number(pagination.total) || 0));
    } catch (error) {
      logApiError(error, "Failed to load dispatch data");
      setDispatchRows([]);
      setTotalPages(1);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData();
  }, [query, statusFilter, clientFilter, dateFilter, currentPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const onSearchSubmit = () => {
    const nextQuery = searchText.trim();
    setQuery(nextQuery);
    setCurrentPage(1);
  };

  const openDispatchModal = (order) => {
    if (!canManageDispatch) return;
    setEditingDispatchId(null);
    setSelectedOrder(order);
    setDispatchForm({
      dispatch_quantity: String(order.remainingQuantity ?? order.quantity ?? ""),
      dispatch_date: "",
      shipment_status: "",
      packing_done: false,
      remarks: ""
    });
  };

  const dispatchOrder = async (event) => {
    event.preventDefault();
    if (!canManageDispatch) return;
    if (!selectedOrder) return;
    if (!dispatchForm.shipment_status) return;

    const dispatchQty = Number(dispatchForm.dispatch_quantity);
    if (!dispatchQty || dispatchQty <= 0) return;

    try {
      setSaving(true);
      if (editingDispatchId) {
        await api.put(`/dispatch/${editingDispatchId}`, {
          dispatch_quantity: dispatchQty,
          dispatch_date: dispatchForm.dispatch_date || null,
          packing_done: Boolean(dispatchForm.packing_done),
          shipment_status: dispatchForm.shipment_status,
          remarks: dispatchForm.remarks || null
        });
      } else {
        await api.post("/dispatch", {
          order_id: selectedOrder.id,
          dispatch_quantity: dispatchQty,
          dispatch_date: dispatchForm.dispatch_date || null,
          packing_done: Boolean(dispatchForm.packing_done),
          shipment_status: dispatchForm.shipment_status,
          remarks: dispatchForm.remarks || null
        });
      }
      setSelectedOrder(null);
      setEditingDispatchId(null);
      setCurrentPage(1);
      await fetchDispatchData({ page: 1 });
    } catch (error) {
      logApiError(error, "Dispatch save failed");
    } finally {
      setSaving(false);
    }
  };

  const editDispatch = (dispatch) => {
    if (!canManageDispatch) return;
    setEditingDispatchId(dispatch.id);
    setSelectedOrder({
      ...dispatch.order,
      remainingQuantity: Math.max(
        (dispatch.order.quantity || 0) - ((dispatch.order.dispatches || []).reduce((sum, item) => sum + (item.dispatchedQuantity || 0), 0) - (dispatch.dispatchedQuantity || 0)),
        0
      )
    });
    setDispatchForm({
      dispatch_quantity: dispatch.dispatchedQuantity ? String(dispatch.dispatchedQuantity) : "",
      dispatch_date: dispatch.dispatchDate ? new Date(dispatch.dispatchDate).toISOString().slice(0, 10) : "",
      shipment_status: dispatch.shipmentStatus || "",
      packing_done: Boolean(dispatch.packingDone),
      remarks: dispatch.remarks || ""
    });
  };

  const deleteDispatch = async (dispatchId) => {
    if (!canManageDispatch) return;
    if (!window.confirm("Delete this dispatch record?")) return;
    try {
      await api.delete(`/dispatch/${dispatchId}`);
      setCurrentPage(1);
      await fetchDispatchData({ page: 1 });
    } catch (error) {
      logApiError(error, "Failed to delete dispatch");
    }
  };

  const sortedDispatchRows = useMemo(() => {
    const sorted = [...dispatchRows];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (row) => {
      const order = row.order || {};
      const dispatchQty = row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0;
      const remainingQty = row.dispatch
        ? Math.max((order.quantity || 0) - ((order.dispatches || []).reduce((sum, d) => sum + (d.dispatchedQuantity || 0), 0)), 0)
        : (order.remainingQuantity ?? order.quantity ?? 0);
      if (key === "orderNo") return String(order.orderNo || "").toLowerCase();
      if (key === "salesOrderNumber") return String(getDisplaySalesNumber(order) || "").toLowerCase();
      if (key === "product") return String(order.product || "").toLowerCase();
      if (key === "orderQuantity") return Number(order.quantity || 0);
      if (key === "dispatchQuantity") return Number(dispatchQty || 0);
      if (key === "remainingQuantity") return Number(remainingQty || 0);
      if (key === "dispatchDate") return new Date(row.dispatch?.dispatchDate || 0).getTime();
      if (key === "status") return String(row.dispatch?.shipmentStatus || "PACKED").toLowerCase();
      return "";
    };

    sorted.sort((a, b) => {
      const priorityDifference = getDispatchSortPriority(a) - getDispatchSortPriority(b);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      if (key === "orderNo") {
        const ta = new Date(a.dispatch?.dispatchDate || 0).getTime();
        const tb = new Date(b.dispatch?.dispatchDate || 0).getTime();
        if (ta < tb) return -1 * sign;
        if (ta > tb) return 1 * sign;
      }
      return 0;
    });

    return sorted;
  }, [dispatchRows, sortConfig]);

  const onSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const exportDispatches = async () => {
    let rowsToExport = sortedDispatchRows;
    try {
      const { data } = await api.get("/dispatch", {
        params: {
          paginated: 1,
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          client: clientFilter || undefined,
          date: dateFilter || undefined,
          page: 1,
          limit: 0
        }
      });
      rowsToExport = Array.isArray(data?.items) ? data.items : sortedDispatchRows;
    } catch (error) {
      logApiError(error, "Export fallback: using current dispatch rows");
    }

    exportRowsToExcel(
      `dispatches_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "clientCode", header: "Client Code" },
        { key: "packagingSize", header: "Packaging Size" },
        { key: "orderNo", header: "Order No" },
        { key: "salesOrderNo", header: "Sales ID" },
        { key: "product", header: "Product" },
        { key: "orderQuantity", header: "Order QUANTITY" },
        { key: "dispatchQuantity", header: "Dispatch QUANTITY" },
        { key: "remainingQuantity", header: "Remaining QUANTITY" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedDeliveryDate", header: "Expected Delivery Date" },
        { key: "city", header: "City" },
        { key: "pincode", header: "Pincode" },
        { key: "state", header: "State" },
        { key: "countryCode", header: "Country Code" },
        { key: "dispatchDate", header: "Dispatch Date" },
        { key: "status", header: "Status" },
        { key: "prodCompDate", header: "Prod Comp Date" }
      ],
      rowsToExport.map(toExportRow)
    );
  };

  const firstRecord = totalRecords === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastRecord = Math.min((currentPage - 1) * PAGE_SIZE + sortedDispatchRows.length, totalRecords);

  return (
    <div className="dispatch-page">
      <section className="dispatch-card dispatch-header-card">
        <h2>Dispatch</h2>
        <div className="dispatch-header-right">
          <div className="dispatch-header-search">
            <SearchIcon />
            <input
              className="dispatch-search-input"
              placeholder="Search order ID, client, or product"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchSubmit();
              }}
            />
          </div>
        </div>
      </section>

      <section className="dispatch-card">
        <div className="dispatch-toolbar">
          <div className="dispatch-filter-grid">
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={clientFilter}
              onChange={(event) => {
                setClientFilter(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Filter by client"
            />
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="dispatch-toolbar-actions">
            <button className="dispatch-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
            <button className="dispatch-btn-secondary" onClick={exportDispatches}>Export to Excel</button>
          </div>
        </div>

        {loading ? (
          <div className="dispatch-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="dispatch-skeleton-row" />)}
          </div>
        ) : sortedDispatchRows.length ? (
          <>
            <div className="dispatch-table-wrap" ref={tableWrapRef}>
              <div className="dispatch-table-meta">
                Showing {firstRecord}-{lastRecord} of {totalRecords} records
              </div>
              <table className="dispatch-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Client Code</th>
                    <th>Packaging Size</th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("orderNo")}>Order No</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales ID</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("orderQuantity")}>Order QUANTITY</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("dispatchQuantity")}>Dispatch QUANTITY</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("remainingQuantity")}>Remaining QUANTITY</button></th>
                    <th>Unit of Measurement</th>
                    <th>Expected Delivery Date</th>
                    <th>City</th>
                    <th>Pincode</th>
                    <th>State</th>
                    <th>Country Code</th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("dispatchDate")}>Dispatch Date</button></th>
                    <th><button className="dispatch-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                    <th>Prod Comp Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
              <VirtualizedTableBody
                rows={sortedDispatchRows}
                colSpan={19}
                rowHeight={52}
                overscan={8}
                scrollContainerRef={tableWrapRef}
                getRowKey={(row) => row.key}
                renderRow={(row, index) => {
                  const order = row.order || {};
                  const shipment = getDispatchRowStatus(row);
                  const remainingQty = getOrderRemainingQuantity(order, row.dispatch);

                  return (
                    <tr key={row.key}>
                      <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{getClientCode(order.clientName, order.id)}</td>
                      <td>{order.packingSize || "-"}</td>
                      <td>{order.orderNo || "-"}</td>
                      <td>{getDisplaySalesNumber(order) || "-"}</td>
                      <td>{order.product || "-"}</td>
                      <td>{order.quantity || 0}</td>
                      <td>{row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0}</td>
                      <td>{remainingQty}</td>
                      <td>{order.unit || "-"}</td>
                      <td>{formatDate(order.deliveryDate)}</td>
                      <td>{order.city || "-"}</td>
                      <td>{order.pincode || "-"}</td>
                      <td>{order.state || "-"}</td>
                      <td>{order.countryCode || "-"}</td>
                      <td>{row.dispatch ? formatDate(row.dispatch.dispatchDate) : "-"}</td>
                      <td>
                        <span className={`dispatch-status ${shipment.className}`}>{shipment.label}</span>
                      </td>
                      <td>{formatDate(order.production?.productionCompletionDate)}</td>
                      <td>
                        <div className="dispatch-actions">
                          {canManageDispatch && (row.dispatch ? (
                            <>
                              <button className="icon-btn" onClick={() => editDispatch(row.dispatch)} aria-label="Edit dispatch"><EditIcon /></button>
                              <button className="icon-btn danger" onClick={() => deleteDispatch(row.dispatch.id)} aria-label="Delete dispatch"><TrashIcon /></button>
                            </>
                          ) : (
                            <button className="dispatch-btn-primary" onClick={() => openDispatchModal(order)}>Dispatch Now</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                }}
              />
              </table>
              <div className="dispatch-pagination">
                <div className="dispatch-pagination-info">Page {currentPage} of {totalPages}</div>
                <div className="dispatch-page-controls">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="dispatch-empty-state compact">
            <div className="dispatch-empty-icon"><TruckIcon /></div>
            <p>No dispatch records match current filters</p>
          </div>
        )}
      </section>

      {selectedOrder && canManageDispatch && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal-card">
            <div className="dispatch-modal-head">
              <div>
                <h3>Shipment Details</h3>
                <p>{getDisplaySalesNumber(selectedOrder)} - {selectedOrder.clientName}</p>
              </div>
              <button className="dispatch-modal-close" onClick={() => setSelectedOrder(null)} disabled={saving}>
                Close
              </button>
            </div>

            <form className="dispatch-form-grid" onSubmit={dispatchOrder}>
              <div>
                <label>Dispatch Quantity</label>
                <input
                  type="number"
                  min="1"
                  value={dispatchForm.dispatch_quantity}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, dispatch_quantity: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Remaining Quantity</label>
                <input
                  type="number"
                  value={selectedOrder.remainingQuantity ?? selectedOrder.quantity ?? 0}
                  readOnly
                />
              </div>
              <div>
                <label>Dispatch Date</label>
                <input
                  type="date"
                  value={dispatchForm.dispatch_date}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, dispatch_date: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Shipment Status</label>
                <select
                  value={dispatchForm.shipment_status}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, shipment_status: event.target.value }))}
                  required
                >
                  <option value="" disabled>Select status</option>
                  {shipmentStatusOptions.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="full-row">
                
              </div>
              <div className="full-row">
                <label>Remarks</label>
                <textarea
                  rows="2"
                  value={dispatchForm.remarks}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, remarks: event.target.value }))}
                />
              </div>
              <div className="full-row dispatch-form-actions">
                <button type="button" className="dispatch-btn-secondary" onClick={() => setSelectedOrder(null)} disabled={saving}>
                  Cancel
                </button>
                <button className="dispatch-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : editingDispatchId ? "Save Changes" : "Dispatch Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DispatchPage;
