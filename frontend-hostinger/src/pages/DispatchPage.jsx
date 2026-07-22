import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { EditIcon, SearchIcon, TrashIcon, TruckIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { getDisplaySalesNumber } from "../utils/businessNumbers";
import { getDispatchSortPriority } from "../utils/dispatchOrdering";
import SearchableSelect from "../components/common/SearchableSelect";
import { findCustomerProfile } from "../utils/customerLookup";
import { fetchAllPages } from "../utils/listWindow";
import { minEntryDateFor } from "../utils/dateRules";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// An order can have multiple production batches; use the latest completion
// date among batches that have actually finished rather than just the
// single most-recently-created batch (which may still be in progress).
function getLatestProductionCompletionDate(order) {
  const dates = (order.productions || [])
    .map((p) => p.productionCompletionDate)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return null;
  return new Date(Math.max(...dates.map((d) => d.getTime())));
}

function mapShipmentStatus(status) {
  if (status === "PACKING") return { label: "Pending", className: "pending" };
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

function getDispatchModalRemainingQuantity(order, dispatchQty, originalDispatchQuantity = 0) {
  if (!order) return 0;

  const baseRemaining = Number(order.remainingQuantity ?? order.quantity ?? 0);
  const currentDispatchQuantity = Number(dispatchQty || 0);
  const previousDispatchQuantity = Number(originalDispatchQuantity || 0);

  return Math.max(baseRemaining + previousDispatchQuantity - currentDispatchQuantity, 0);
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

// The order's own packingSize is only ever what was typed at order-creation
// time (often "NA" for orders auto-created from an enquiry). Once the order
// has actually been packed, show the packing material used instead.
function getPackagingDisplay(order) {
  const packedMaterial = order?.packingRecords?.[0]?.packingMaterialItemId;
  if (packedMaterial) return packedMaterial;
  const size = order?.packingSize;
  return size && size !== "NA" ? size : "-";
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

// Falls back to Customer Master when the order's own location fields are
// blank (e.g. orders created before an enquiry carried the customer's
// address over automatically) so the client never has to be typed twice.
function getDispatchOrderLocation(order, customerMasterRows) {
  const profile = findCustomerProfile(customerMasterRows, order?.clientName);
  return {
    city: order?.city || profile?.city || "",
    pincode: order?.pincode || profile?.pincode || "",
    state: order?.state || profile?.state || "",
    countryCode: order?.countryCode || profile?.countryCode || ""
  };
}

function toExportRow(row, customerMasterRows) {
  const order = row.order || {};
  const dispatch = row.dispatch;
  const dispatchQuantity = dispatch?.dispatchedQuantity || 0;
  const remainingQuantity = getOrderRemainingQuantity(order, dispatch);
  const location = getDispatchOrderLocation(order, customerMasterRows);

  return {
    clientCode: getClientCode(order.clientName, order.id),
    packagingSize: getPackagingDisplay(order),
    salesOrderNo: getDisplaySalesNumber(order) || "-",
    product: order.product || "-",
    orderQuantity: order.quantity || 0,
    dispatchQuantity,
    remainingQuantity,
    unit: order.unit || "-",
    expectedDeliveryDate: formatDate(order.deliveryDate),
    city: location.city || "-",
    pincode: location.pincode || "-",
    state: location.state || "-",
    countryCode: location.countryCode || "-",
    dispatchDate: dispatch ? formatDate(dispatch.dispatchDate) : "-",
    status: getDispatchRowStatus(row).label,
    prodCompDate: formatDate(getLatestProductionCompletionDate(order))
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
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) { setDateFilter(""); } }, [isMobile]);
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
    original_dispatch_quantity: 0,
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
  const dispatchModalRemainingQuantity = useMemo(() => (
    getDispatchModalRemainingQuantity(
      selectedOrder,
      dispatchForm.dispatch_quantity,
      dispatchForm.original_dispatch_quantity
    )
  ), [dispatchForm.dispatch_quantity, dispatchForm.original_dispatch_quantity, selectedOrder]);

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
      original_dispatch_quantity: 0,
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
      original_dispatch_quantity: Number(dispatch.dispatchedQuantity || 0),
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
      // Paged, not `limit: 0` — see utils/listWindow.js. Pulling every row into
      // one response is what makes a 10,000-row export unusable on a phone.
      rowsToExport = await fetchAllPages("/dispatch", {
        paginated: 1,
        q: query || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        client: clientFilter || undefined,
        date: dateFilter || undefined
      });
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
      rowsToExport.map((row) => toExportRow(row, masterData.customerMaster))
    );
  };

  const firstRecord = totalRecords === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const lastRecord = Math.min((currentPage - 1) * PAGE_SIZE + sortedDispatchRows.length, totalRecords);

  return (
    <div className="dispatch-page">
      {/* HEADER */}
      <section className="order-card">
        <div className="order-header-card">
          <div className="order-header-left">
            <h2>Dispatch</h2>
          </div>
        </div>
      </section>

      {/* SEARCH + FILTERS + ACTIONS */}
      <section className="order-card">
        <div className="unified-search-box">
          <SearchIcon />
          <input autoComplete="off"
            placeholder="Search order ID, client, or product"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onSearchSubmit();
            }}
          />
        </div>

        <div className="unified-filter-row">
          <SearchableSelect
            options={statusFilterOptions}
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            placeholder="All Status"
          />
          <input autoComplete="off"
            type="text"
            value={clientFilter}
            onChange={(event) => {
              setClientFilter(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter by client"
          />
          {!isMobile && (
            <input autoComplete="off"
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setCurrentPage(1);
              }}
            />
          )}
        </div>

        <div className="unified-actions">
          <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
          <button className="order-btn-secondary" onClick={exportDispatches}>Export to Excel</button>
        </div>
      </section>

      <section className="order-card">

        {loading ? (
          <div className="dispatch-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="dispatch-skeleton-row" />)}
          </div>
        ) : sortedDispatchRows.length ? (
          <>
            {!isMobile && <div className="dispatch-table-wrap" ref={tableWrapRef}>
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
                colSpan={18}
                rowHeight={52}
                overscan={8}
                scrollContainerRef={tableWrapRef}
                getRowKey={(row) => row.key}
                renderRow={(row, index) => {
                  const order = row.order || {};
                  const shipment = getDispatchRowStatus(row);
                  const remainingQty = getOrderRemainingQuantity(order, row.dispatch);
                  const location = getDispatchOrderLocation(order, masterData.customerMaster);

                  return (
                    <tr key={row.key}>
                      <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{getClientCode(order.clientName, order.id)}</td>
                      <td>{getPackagingDisplay(order)}</td>
                      <td>{order.orderNo || "-"}</td>
                      <td>{order.product || "-"}</td>
                      <td>{order.quantity || 0}</td>
                      <td>{row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0}</td>
                      <td>{remainingQty}</td>
                      <td>{order.unit || "-"}</td>
                      <td>{formatDate(order.deliveryDate)}</td>
                      <td>{location.city || "-"}</td>
                      <td>{location.pincode || "-"}</td>
                      <td>{location.state || "-"}</td>
                      <td>{location.countryCode || "-"}</td>
                      <td>{row.dispatch ? formatDate(row.dispatch.dispatchDate) : "-"}</td>
                      <td>
                        <span className={`dispatch-status ${shipment.className}`}>{shipment.label}</span>
                      </td>
                      <td>{formatDate(getLatestProductionCompletionDate(order))}</td>
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
            </div>}

            {isMobile && <div className="order-mobile-list">
              <div style={{ marginBottom: 12, fontSize: 12, color: '#64748b', paddingLeft: 4 }}>
                Showing {firstRecord}-{lastRecord} of {totalRecords} records
              </div>
              {sortedDispatchRows.map((row) => {
                const order = row.order || {};
                const shipment = getDispatchRowStatus(row);
                const remainingQty = getOrderRemainingQuantity(order, row.dispatch);
                const cls = shipment.className;
                const stateClass =
                  cls === "delivered" ? "is-complete" :
                  cls === "in-transit" ? "is-progress" :
                  cls === "partial" ? "is-hold" : "is-pending";
                const stage = cls === "delivered" ? 2 : (cls === "in-transit" || cls === "partial") ? 1 : 0;
                return (
                  <div key={row.key} className={`prod-mcard ${stateClass}`} style={{ cursor: "default" }}>
                    <div className="prod-mcard-top">
                      <div className="prod-mcard-idwrap">
                        <span className="prod-mcard-code">{order.orderNo || "-"}</span>
                        <span className="prod-mcard-name">{order.product || "-"}</span>
                      </div>
                      <span className={`prod-mcard-pill ${stateClass}`}>{shipment.label}</span>
                    </div>

                    <div className="prod-mcard-meta">
                      {order.clientName && <span>{order.clientName}</span>}
                      <span>{row.dispatch ? (row.dispatch.dispatchedQuantity || 0) : 0}/{order.quantity || 0} {order.unit || ""}</span>
                      {order.city && <span>{order.city}</span>}
                      <span>{row.dispatch ? formatDate(row.dispatch.dispatchDate) : `Due ${formatDate(order.deliveryDate)}`}</span>
                    </div>

                    <div className="prod-steps">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className={`prod-step ${i <= stage ? `done ${stateClass}` : ""}`} />
                      ))}
                    </div>
                    <div className="prod-steps-labels">
                      <span>Packed</span><span>Dispatched</span><span>Delivered</span>
                    </div>

                    {canManageDispatch && (
                      <div className="prod-mcard-actions">
                        {row.dispatch ? (
                          <>
                            <button className="pa-primary" onClick={() => editDispatch(row.dispatch)}>Update dispatch</button>
                            <button className="pa-ghost danger" onClick={() => deleteDispatch(row.dispatch.id)} aria-label="Delete dispatch">
                              <TrashIcon />
                            </button>
                          </>
                        ) : (
                          <button className="pa-primary" onClick={() => openDispatchModal(order)}>Dispatch now</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="dispatch-pagination" style={{ borderTop: "none", paddingTop: 16 }}>
                <div className="dispatch-pagination-info">Page {currentPage} of {totalPages}</div>
                <div className="dispatch-page-controls">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            </div>}
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
                <input autoComplete="off"
                  type="number"
                  step="any"
                  min="1"
                  value={dispatchForm.dispatch_quantity}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, dispatch_quantity: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Remaining Quantity</label>
                <input autoComplete="off"
                  type="number"
                  value={dispatchModalRemainingQuantity}
                  readOnly
                />
              </div>
              <div>
                <label>Dispatch Date</label>
                <input autoComplete="off"
                  type="date"
                  min={minEntryDateFor(dispatchForm.dispatch_date)}
                  value={dispatchForm.dispatch_date}
                  onChange={(event) => setDispatchForm((prev) => ({ ...prev, dispatch_date: event.target.value }))}
                  required
                />
              </div>
              <div>
                <label>Shipment Status</label>
                <SearchableSelect
                  options={shipmentStatusOptions}
                  value={dispatchForm.shipment_status}
                  onChange={(value) => setDispatchForm((prev) => ({ ...prev, shipment_status: value }))}
                  placeholder="Select status"
                />
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
