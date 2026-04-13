import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";
import DispatchMobileModule from "../components/mobile/modules/DispatchMobileModule";
import { EditIcon, SearchIcon, TrashIcon, TruckIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useIsMobile from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";

const statusFilterOptions = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" }
];

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function toISODate(dateValue) {
  if (!dateValue) return "";
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function mapShipmentStatus(status) {
  if (status === "PACKING") return { label: "Pending", className: "pending" };
  if (status === "SHIPPED") return { label: "In Transit", className: "in-transit" };
  if (status === "DELIVERED") return { label: "Delivered", className: "delivered" };
  return { label: status || "Pending", className: "pending" };
}

function getOrderStatusLabel(status) {
  if (status === "IN_PRODUCTION") return "In Production";
  if (status === "DISPATCHED") return "Dispatched";
  if (status === "COMPLETED") return "Completed";
  return status || "-";
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

function DispatchPage() {
  const PAGE_SIZE = 10;
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingDispatchId, setEditingDispatchId] = useState(null);
  const [readyOrders, setReadyOrders] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "dispatchDate", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_quantity: "",
    dispatch_date: "",
    shipment_status: "",
    packing_done: false,
    remarks: ""
  });
  const canManageDispatch = ["admin", "dispatch"].includes(user?.role);

  if (isMobile) {
    return <DispatchMobileModule canManage={canManageDispatch} />;
  }

  const fetchDispatchData = async (searchQuery = query) => {
    setLoading(true);
    try {
      const { data } = await api.get("/dispatch", { params: { q: searchQuery || undefined } });
      setReadyOrders(data.readyOrders || []);
      setDispatches(data.dispatches || []);
    } catch (error) {
      logApiError(error, "Failed to load dispatch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchData("");
  }, []);

  const filteredReadyOrders = useMemo(() => {
    return readyOrders.filter((order) => {
      const matchesStatus = statusFilter === "all" || statusFilter === "pending";
      const matchesClient = clientFilter
        ? order.clientName?.toLowerCase().includes(clientFilter.toLowerCase())
        : true;
      const matchesDate = dateFilter ? toISODate(order.deliveryDate) === dateFilter : true;
      return matchesStatus && matchesClient && matchesDate;
    });
  }, [readyOrders, statusFilter, clientFilter, dateFilter]);

  const filteredDispatches = useMemo(() => {
    return dispatches.filter((dispatch) => {
      const shipment = mapShipmentStatus(dispatch.shipmentStatus);
      const matchesStatus = statusFilter === "all" ? true : shipment.className === statusFilter.replace("_", "-");
      const matchesClient = clientFilter
        ? dispatch.order?.clientName?.toLowerCase().includes(clientFilter.toLowerCase())
        : true;
      const matchesDate = dateFilter ? toISODate(dispatch.dispatchDate) === dateFilter : true;
      return matchesStatus && matchesClient && matchesDate;
    });
  }, [dispatches, statusFilter, clientFilter, dateFilter]);

  const onSearchSubmit = () => {
    const nextQuery = searchText.trim();
    setQuery(nextQuery);
    setCurrentPage(1);
    fetchDispatchData(nextQuery);
  };

  const openDispatchModal = (order) => {
    if (!canManageDispatch) return;
    setEditingDispatchId(null);
    setSelectedOrder(order);
    setDispatchForm({
      dispatch_quantity: order.remainingQuantity ? String(order.remainingQuantity) : String(order.quantity || ""),
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
    if (!dispatchForm.shipment_status) {
      return;
    }
    const dispatchQty = Number(dispatchForm.dispatch_quantity);
    if (!dispatchQty || dispatchQty <= 0) {
      return;
    }

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
      await fetchDispatchData();
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
      id: dispatch.order.id,
      salesOrderNumber: dispatch.order.salesOrderNumber,
      clientName: dispatch.order.clientName
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
      await fetchDispatchData();
    } catch (error) {
      logApiError(error, "Failed to delete dispatch");
    }
  };

  const exportDispatches = () => {
    const combinedRows = [
      ...filteredDispatches.map((dispatch) => ({
        clientCode: getClientCode(dispatch.order?.clientName, dispatch.order?.id),
        packagingSize: dispatch.order?.packingSize || "-",
        salesOrderNo: dispatch.order?.salesOrderNumber || "-",
        product: dispatch.order?.product || "-",
        orderQuantity: dispatch.order?.quantity || 0,
        dispatchQuantity: dispatch.dispatchedQuantity || 0,
        remainingQuantity: Math.max((dispatch.order?.quantity || 0) - ((dispatch.order?.dispatches || []).reduce((sum, d) => sum + (d.dispatchedQuantity || 0), 0)), 0),
        unit: dispatch.order?.unit || "-",
        expectedDeliveryDate: formatDate(dispatch.order?.deliveryDate),
        city: dispatch.order?.city || "-",
        pincode: dispatch.order?.pincode || "-",
        state: dispatch.order?.state || "-",
        countryCode: dispatch.order?.countryCode || "-",
        dispatchDate: formatDate(dispatch.dispatchDate),
        status: mapShipmentStatus(dispatch.shipmentStatus).label,
        orderStatus: getOrderStatusLabel(dispatch.order?.status),
        prodCompDate: formatDate(dispatch.order?.production?.productionCompletionDate),
      })),
      ...filteredReadyOrders.map((order) => ({
        clientCode: getClientCode(order.clientName, order.id),
        packagingSize: order.packingSize || "-",
        salesOrderNo: order.salesOrderNumber,
        product: order.product,
        orderQuantity: order.quantity,
        dispatchQuantity: 0,
        remainingQuantity: order.remainingQuantity ?? order.quantity,
        unit: order.unit,
        expectedDeliveryDate: formatDate(order.deliveryDate),
        city: order.city || "-",
        pincode: order.pincode || "-",
        state: order.state || "-",
        countryCode: order.countryCode || "-",
        dispatchDate: "-",
        status: "Pending",
        orderStatus: getOrderStatusLabel(order.status),
        prodCompDate: formatDate(order.production?.productionCompletionDate)
      }))
    ];

    exportRowsToExcel(
      `dispatches_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "clientCode", header: "Client Code" },
        { key: "packagingSize", header: "Packaging Size" },
        { key: "salesOrderNo", header: "Sales Order No" },
        { key: "product", header: "Product" },
        { key: "orderQuantity", header: "Order QTY" },
        { key: "dispatchQuantity", header: "Dispatch QTY" },
        { key: "remainingQuantity", header: "Remaining QTY" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedDeliveryDate", header: "Expected Delivery Date" },
        { key: "city", header: "City" },
        { key: "pincode", header: "Pincode" },
        { key: "state", header: "State" },
        { key: "countryCode", header: "Country Code" },
        { key: "dispatchDate", header: "Dispatch Date" },
        { key: "status", header: "Status" },
        { key: "orderStatus", header: "Order Status" },
        { key: "prodCompDate", header: "Prod Comp Date" } 
      ],
      combinedRows
    );
  };

  const combinedDispatchRows = useMemo(() => {
    const autoRows = filteredDispatches.map((dispatch) => ({
      key: `dispatch-${dispatch.id}`,
    
      order: dispatch.order,
      dispatch
    }));
    const manualRows = filteredReadyOrders.map((order) => ({
      key: `ready-${order.id}`,
      
      order,
      dispatch: null
    }));
    return [...autoRows, ...manualRows];
  }, [filteredDispatches, filteredReadyOrders]);

  const sortedDispatchRows = useMemo(() => {
    const sorted = [...combinedDispatchRows];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (row) => {
      const order = row.order || {};
      const dispatchQty = row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0;
      const remainingQty = row.dispatch
        ? Math.max((order.quantity || 0) - ((order.dispatches || []).reduce((sum, d) => sum + (d.dispatchedQuantity || 0), 0)), 0)
        : (order.remainingQuantity ?? order.quantity ?? 0);
      if (key === "salesOrderNumber") return String(order.salesOrderNumber || "").toLowerCase();
      if (key === "product") return String(order.product || "").toLowerCase();
      if (key === "orderQuantity") return Number(order.quantity || 0);
      if (key === "dispatchQuantity") return Number(dispatchQty || 0);
      if (key === "remainingQuantity") return Number(remainingQty || 0);
      if (key === "dispatchDate") return new Date(row.dispatch?.dispatchDate || 0).getTime();
      if (key === "status") return String(row.dispatch?.shipmentStatus || "PACKING").toLowerCase();
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
  }, [combinedDispatchRows, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedDispatchRows.length / PAGE_SIZE));

  const paginatedDispatchRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedDispatchRows.slice(start, start + PAGE_SIZE);
  }, [sortedDispatchRows, currentPage]);

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

  return (
    <div className="dispatch-page">
      <section className="dispatch-card dispatch-search-card">
        <div className="dispatch-search-wrap">
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
          <button className="dispatch-search-btn" onClick={onSearchSubmit}>Search</button>
        </div>

        <div className="dispatch-filter-grid">
          <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={clientFilter}
            onChange={(event) => { setClientFilter(event.target.value); setCurrentPage(1); }}
            placeholder="Filter by client"
          />
          <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} />
        </div>
      </section>

      <section className="dispatch-card">
        <div className="dispatch-section-head">
          <h2>Dispatch Module (Auto-Generated)</h2>
          <button className="dispatch-btn-secondary" onClick={exportDispatches}>Export to Excel</button>
        </div>

        {loading ? (
          <div className="dispatch-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="dispatch-skeleton-row" />)}
          </div>
        ) : combinedDispatchRows.length ? (
          <>
            <div className="dispatch-table-wrap">
            <div className="dispatch-table-meta">
              Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, sortedDispatchRows.length)}-
              {Math.min(currentPage * PAGE_SIZE, sortedDispatchRows.length)} of {sortedDispatchRows.length} records
            </div>
            <table className="dispatch-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Client Code</th>
                  <th>Packaging Size</th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales Order No</button></th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("orderQuantity")}>Order QTY</button></th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("dispatchQuantity")}>Dispatch QTY</button></th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("remainingQuantity")}>Remaining QTY</button></th>
                  <th>Unit of Measurement</th>
                  <th>Expected Delivery Date</th>
                  <th>City</th>
                  <th>Pincode</th>
                  <th>State</th>
                  <th>Country Code</th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("dispatchDate")}>Dispatch Date</button></th>
                  <th><button className="dispatch-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                  <th>Order Status</th>
                  <th>Prod Comp Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDispatchRows.map((row, index) => {
                  const order = row.order;
                  const shipment = row.dispatch ? mapShipmentStatus(row.dispatch.shipmentStatus) : { label: "Pending", className: "pending" };
                  return (
                    <tr key={row.key}>
                      <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{getClientCode(order.clientName, order.id)}</td>
                      <td>{order.packingSize || "-"}</td>
                      <td>{order.salesOrderNumber}</td>
                      <td>{order.product}</td>
                      <td>{order.quantity}</td>
                      <td>{row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0}</td>
                      <td>{row.dispatch ? Math.max((order.quantity || 0) - ((order.dispatches || []).reduce((sum, d) => sum + (d.dispatchedQuantity || 0), 0)), 0) : (order.remainingQuantity ?? order.quantity)}</td>
                      <td>{order.unit}</td>
                      <td>{formatDate(order.deliveryDate)}</td>
                      <td>{order.city || "-"}</td>
                      <td>{order.pincode || "-"}</td>
                      <td>{order.state || "-"}</td>
                      <td>{order.countryCode || "-"}</td>
                      <td>{row.dispatch ? formatDate(row.dispatch.dispatchDate) : "-"}</td>
                      <td>
                        <span className={`dispatch-status ${shipment.className}`}>{shipment.label}</span>
                      </td>
                      <td>{getOrderStatusLabel(order.status)}</td>
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
                })}
              </tbody>
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
                <p>{selectedOrder.salesOrderNumber} - {selectedOrder.clientName}</p>
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
                {!editingDispatchId && (
                  <small>Remaining: {selectedOrder.remainingQuantity ?? selectedOrder.quantity} {selectedOrder.unit || ""}</small>
                )}
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
                  <option value="PACKING">Pending</option>
                  <option value="SHIPPED">In Transit</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
              <div className="full-row">
                <label className="dispatch-checkbox-row">
                  <input
                    type="checkbox"
                    checked={dispatchForm.packing_done}
                    onChange={(event) => setDispatchForm((prev) => ({ ...prev, packing_done: event.target.checked }))}
                  />
                  Packing Done
                </label>
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
