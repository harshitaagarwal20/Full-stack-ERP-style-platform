import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { BoxesIcon, EditIcon, EyeIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { logApiError } from "../utils/apiError";
import { findCustomerProfile } from "../utils/customerLookup";
import { exportRowsToExcel } from "../utils/exportExcel";
import { CURRENCY_OPTIONS, formatPriceValue } from "../utils/commerce";
import { getDisplaySalesGroupNumber } from "../utils/businessNumbers";
import { formatEnquiryProducts } from "../utils/enquiryProducts";

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function formatDateTime(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleString() : "-";
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

function getOrderStatusClass(status) {
  if (status === "IN_PRODUCTION") return "in-production";
  if (status === "READY_FOR_DISPATCH") return "ready";
  if (status === "PARTIALLY_DISPATCHED") return "partial";
  if (status === "COMPLETED" || status === "DISPATCHED") return "dispatched";
  if (status === "APPROVED") return "approved";
  return "created";
}

function getOrderStatusLabel(status) {
  if (status === "IN_PRODUCTION") return "In Production";
  if (status === "READY_FOR_DISPATCH") return "Ready for Dispatch";
  if (status === "PARTIALLY_DISPATCHED") return "Partially Dispatched";
  if (status === "DISPATCHED") return "Completed";
  if (status === "COMPLETED") return "Completed";
  if (status === "APPROVED") return "Approved";
  return "Created";
}

function getProductionStatusLabel(order) {
  if (order.production?.status === "COMPLETED") return "Completed";
  if (order.production?.status === "IN_PROGRESS") return "Started";
  if (order.status === "READY_FOR_DISPATCH" || order.status === "PARTIALLY_DISPATCHED" || order.status === "DISPATCHED" || order.status === "COMPLETED") return "Completed";
  if (order.status === "IN_PRODUCTION") return "Started";
  return "Not Started";
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

function getMissingLocationFields(order) {
  const missing = [];
  if (!(order.city || "").trim()) missing.push("City");
  if (!(order.pincode || "").trim()) missing.push("Pincode");
  if (!(order.state || "").trim()) missing.push("State");
  if (!(order.countryCode || "").trim()) missing.push("Country");
  return missing;
}

const UNIT_OPTIONS = ["MT", "KG"];

function createEmptyProductRow() {
  return { product: "", grade: "", quantity: "", unit_of_measurement: "" };
}

function createCreateForm() {
  return {
    product: "",
    grade: "",
    quantity: "",
    price: "",
    currency: "INR",
    unit: "KG",
    delivery_date: "",
    client_name: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    country_code: "IN",
    remarks: "",
    products: [createEmptyProductRow()]
  };
}

function OrderPage() {
  const PAGE_SIZE = 10;
  const navigate = useNavigate();
  const { user } = useAuth();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [form, setForm] = useState(createCreateForm());
  const tableWrapRef = useRef(null);
  const customerMasterRows = useMemo(
    () => (Array.isArray(masterData.customerMaster) ? masterData.customerMaster : []),
    [masterData.customerMaster]
  );
  const selectedCustomerProfile = useMemo(
    () => findCustomerProfile(customerMasterRows, form.client_name),
    [customerMasterRows, form.client_name]
  );
  const getOrderLocation = (order) => {
    const profile = findCustomerProfile(customerMasterRows, order?.clientName);
    return {
      city: (order?.city || profile?.city || "").trim(),
      pincode: (order?.pincode || profile?.pincode || "").trim(),
      state: (order?.state || profile?.state || "").trim(),
      countryCode: (order?.countryCode || profile?.countryCode || "").trim()
    };
  };
  const selectedOrderLocation = useMemo(
    () => (selectedOrder ? getOrderLocation(selectedOrder) : null),
    [selectedOrder, customerMasterRows]
  );
  const orderUnitOptions = useMemo(() => {
    const current = String(form.unit || "").trim();
    if (current && !UNIT_OPTIONS.includes(current)) {
      return [current, ...UNIT_OPTIONS];
    }
    return UNIT_OPTIONS;
  }, [form.unit]);
  const productOptions = useMemo(() => {
    const options = Array.isArray(masterData.products) ? masterData.products : [];
    const current = String(form.product || "").trim();
    if (current && !options.some((item) => item.value === current)) {
      return [{ value: current, label: current }, ...options];
    }
    return options;
  }, [form.product, masterData.products]);
  const requestProductOptions = productOptions;
  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      ...masterData.orderStatuses.map((status) => ({
        value: status.value,
        label: status.label
      }))
    ],
    [masterData.orderStatuses]
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const ordersRes = await api.get("/orders", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          client: clientFilter || undefined,
          date: dateFilter || undefined,
          page: currentPage,
          limit: PAGE_SIZE
        }
      });
      const payload = ordersRes.data;
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const pagination = payload?.pagination || null;
      setOrders(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
    } catch (error) {
      logApiError(error, "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [query, statusFilter, clientFilter, dateFilter, currentPage]);

  const sortedOrders = useMemo(() => {
    const sorted = [...orders];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (order) => {
      if (key === "createdAt") return new Date(order.createdAt || order.orderDate || 0).getTime();
      if (key === "salesOrderNumber") return String(getDisplaySalesGroupNumber(order) || "").toLowerCase();
      if (key === "product") return String(order.product || "").toLowerCase();
      if (key === "quantity") return Number(order.quantity || 0);
      if (key === "deliveryDate") return new Date(order.deliveryDate || 0).getTime();
      if (key === "clientName") return String(order.clientName || "").toLowerCase();
      if (key === "status") return String(order.status || "").toLowerCase();
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
  }, [orders, sortConfig]);

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

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    try {
      if (editingOrderId) {
        const payload = {
          ...form,
          quantity: Number(form.quantity),
          price: form.price === "" ? null : Number(form.price),
          currency: form.currency || null
        };
        await api.put(`/orders/${editingOrderId}`, payload);
      } else {
        const productRows = (form.products || [])
          .map((row) => ({
            product: String(row.product || "").trim(),
            grade: String(row.grade || "").trim(),
            quantity: Number(row.quantity || 0),
            unit_of_measurement: String(row.unit_of_measurement || "").trim()
          }))
          .filter((row) => row.product);

        if (!productRows.length) {
          window.alert("Add at least one product before saving the manual request.");
          setCreating(false);
          return;
        }

        const invalidRow = productRows.find((row) => !row.quantity || !row.unit_of_measurement);
        if (invalidRow) {
          window.alert("Fill product, quantity, and unit of measurement for each requested row.");
          setCreating(false);
          return;
        }

        const productSummary = formatEnquiryProducts(productRows);
        const payload = {
          client_name: form.client_name,
          address: form.address,
          city: form.city,
          pincode: form.pincode,
          state: form.state,
          country_code: form.country_code,
          delivery_date: form.delivery_date,
          remarks: form.remarks || null,
          products: productRows,
          product: productSummary,
          unit: productRows[0]?.unit_of_measurement || "KG",
          quantity: productRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
          grade: productRows[0]?.grade || ""
        };
        await api.post("/manual-orders", payload);
        navigate("/approval");
      }
      setForm(createCreateForm());
      setEditingOrderId(null);
      setIsCreateModalOpen(false);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save order");
    } finally {
      setCreating(false);
    }
  };

  const exportOrders = async () => {
    let exportSource = sortedOrders;
    try {
      const { data } = await api.get("/orders", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          client: clientFilter || undefined,
          date: dateFilter || undefined,
          page: 1,
          limit: 0
        }
      });
      exportSource = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : sortedOrders;
    } catch {
      // Fall back to currently loaded page.
    }

    exportRowsToExcel(
      `orders_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "timestamp", header: "Timestamp" },
        { key: "salesGroupNumber", header: "Sales ID" },
        { key: "orderNo", header: "Order No" },
        { key: "product", header: "Product" },
        { key: "grade", header: "Grade" },
        { key: "quantity", header: "Qty" },
        { key: "price", header: "Price" },
        { key: "currency", header: "Currency" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedTimeline", header: "Expected Timeline" },
        { key: "clientName", header: "Client Name" },
        { key: "clientCode", header: "Client Code" },
        { key: "address", header: "Address" },
        { key: "city", header: "City" },
        { key: "pincode", header: "Pincode" },
        { key: "state", header: "State" },
        { key: "countryCode", header: "Country Code" },
        { key: "prodStatus", header: "Prod Status" },
        { key: "prodCompDate", header: "Prod Comp Date" },
        { key: "dispatchDate", header: "Dispatch Date" },
        { key: "status", header: "Order Status" }
      ],
      exportSource.map((order) => ({
        ...(function () {
          const location = getOrderLocation(order);
          return {
            city: location.city || "-",
            pincode: location.pincode || "-",
            state: location.state || "-",
            countryCode: location.countryCode || "-"
          };
        })(),
        timestamp: formatDateTime(order.createdAt || order.orderDate),
        salesGroupNumber: getDisplaySalesGroupNumber(order),
        orderNo: order.orderNo,
        product: order.product,
        grade: order.grade,
        quantity: order.quantity,
        price: formatPriceValue(order.price),
        currency: order.currency || "-",
        unit: order.unit,
        expectedTimeline: formatDate(order.deliveryDate),
        clientName: order.clientName,
        clientCode: getClientCode(order.clientName, order.id),
        address: order.address || "-",
        prodStatus: getProductionStatusLabel(order),
        prodCompDate: formatDate(order.production?.productionCompletionDate),
        dispatchDate: formatDate(getOrderDispatchDate(order)),
        status: getOrderStatusLabel(order.status)
      }))
    );
  };

  const moveToProduction = async (order) => {
    if (!canCreate) return;
    const location = getOrderLocation(order);
    const missing = getMissingLocationFields({
      city: location.city,
      pincode: location.pincode,
      state: location.state,
      countryCode: location.countryCode
    });
    if (missing.length > 0) {
      window.alert(`Fill these fields before starting production: ${missing.join(", ")}.`);
      return;
    }

    try {
      // Keep order row in sync so backend validations for production pass.
      if (
        location.city !== (order.city || "") ||
        location.pincode !== (order.pincode || "") ||
        location.state !== (order.state || "") ||
        location.countryCode !== (order.countryCode || "")
      ) {
        await api.put(`/orders/${order.id}`, {
          client_name: order.clientName,
          city: location.city,
          pincode: location.pincode,
          state: location.state,
          country_code: location.countryCode
        });
      }
      await api.post("/production", { order_id: order.id });
      await fetchData();
      navigate("/production");
    } catch (error) {
      logApiError(error, "Failed to start production");
    }
  };

  const onEdit = (order) => {
    if (!canCreate) return;
    const location = getOrderLocation(order);
    setEditingOrderId(order.id);
    setForm({
      product: order.product || "",
      grade: order.grade || "",
      quantity: order.quantity ? String(order.quantity) : "",
      price: order.price ?? "",
      currency: order.currency || "",
      unit: order.unit || "KG",
      delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toISOString().slice(0, 10) : "",
      client_name: order.clientName || "",
      address: order.address || "",
      city: location.city || "",
      pincode: location.pincode || "",
      state: location.state || "",
      country_code: location.countryCode || "IN",
      remarks: order.remarks || "",
      products: [createEmptyProductRow()]
    });
    setIsCreateModalOpen(true);
  };

  const onDelete = async (orderId) => {
    if (!canCreate) return;
    if (!window.confirm("Delete this order?")) return;
    try {
      await api.delete(`/orders/${orderId}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to delete order");
    }
  };

  const canCreate = user.role === "sales" || user.role === "admin";

  const onCustomerChange = (customerName) => {
    const normalizedName = String(customerName || "").trim();
    const profile = findCustomerProfile(customerMasterRows, normalizedName);
    if (!profile) {
      setForm((prev) => ({
        ...prev,
        client_name: normalizedName,
        address: "",
        city: "",
        pincode: "",
        state: "",
        country_code: "IN"
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      client_name: normalizedName,
      address: profile.address || "",
      city: profile.city || "",
      pincode: profile.pincode || "",
      state: profile.state || "",
      country_code: profile.countryCode || "IN"
    }));
  };

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <h2>Order </h2>
        <div className="order-header-right">
          <div className="order-header-search">
            <SearchIcon />
            <input
              placeholder="Search sales order, client, product"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchSubmit();
              }}
            />
          </div>
          {canCreate && (
            <button
              className="order-btn-primary"
              onClick={() => {
                setEditingOrderId(null);
                setForm(createCreateForm());
                setIsCreateModalOpen(true);
              }}
            >
              Create Manual Request
            </button>
          )}
         
        </div>
      </section>

      <section className="order-card">
        <div className="order-toolbar">
          <div className="order-filter-grid">
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter by client"
              value={clientFilter}
              onChange={(event) => { setClientFilter(event.target.value); setCurrentPage(1); }}
            />
            <input type="date" value={dateFilter} onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }} />
          </div>
          <div className="order-toolbar-actions">
            <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
            <button className="order-btn-secondary" onClick={exportOrders}>Export to Excel</button>
          </div>
        </div>

        {loading ? (
          <div className="order-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="order-skeleton-row" />)}
          </div>
        ) : sortedOrders.length ? (
          <>
            <div className="order-table-wrap" ref={tableWrapRef}>
              <div className="order-table-meta">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, totalRecords)}-
                {Math.min(currentPage * PAGE_SIZE, totalRecords)} of {totalRecords} records
              </div>
              <table className="order-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("createdAt")}>Timestamp</button></th>
                    <th><button className="order-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales ID</button></th>
                    <th>Order No</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th>Grade</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("quantity")}>Quantity</button></th>
                    <th>Price</th>
                    <th>Currency</th>
                    <th>Unit</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("deliveryDate")}>Expected Timeline</button></th>
                    <th><button className="order-sort-btn" onClick={() => onSort("clientName")}>Client</button></th>
                    <th>Client Code</th>
                    <th>City</th>
                    <th>Pincode</th>
                    <th>State</th>
                    <th>Country</th>
                    <th>Prod Status</th>
                    <th>Prod Comp Date</th>
                    <th>Dispatch Date</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("status")}>Order Status</button></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  rows={sortedOrders}
                  colSpan={22}
                  rowHeight={52}
                  overscan={8}
                  scrollContainerRef={tableWrapRef}
                  getRowKey={(order) => order.id}
                  renderRow={(order, index) => {
                    const location = getOrderLocation(order);
                    return (
                      <tr key={order.id}>
                        <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td>{formatDateTime(order.createdAt || order.orderDate)}</td>
                        <td>{getDisplaySalesGroupNumber(order)}</td>
                        <td>{order.orderNo}</td>
                        <td>{order.product}</td>
                        <td>{order.grade || "-"}</td>
                        <td>{order.quantity}</td>
                        <td>{formatPriceValue(order.price)}</td>
                        <td>{order.currency || "-"}</td>
                        <td>{order.unit}</td>
                        <td>{formatDate(order.deliveryDate)}</td>
                        <td>{order.clientName || "-"}</td>
                        <td>{getClientCode(order.clientName, order.id)}</td>
                        <td>{location.city || "-"}</td>
                        <td>{location.pincode || "-"}</td>
                        <td>{location.state || "-"}</td>
                        <td>{location.countryCode || "-"}</td>
                        <td>{getProductionStatusLabel(order)}</td>
                        <td>{formatDate(order.production?.productionCompletionDate)}</td>
                        <td>{formatDate(getOrderDispatchDate(order))}</td>
                        <td>
                          <span className={`order-status ${getOrderStatusClass(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
                        </td>
                        <td>
                          <div className="order-row-actions">
                            <button className="icon-btn" aria-label="View order" onClick={() => setSelectedOrder(order)}><EyeIcon /></button>
                            {canCreate && <button className="icon-btn" aria-label="Edit order" onClick={() => onEdit(order)}><EditIcon /></button>}
                            {canCreate && <button className="icon-btn danger" aria-label="Delete order" onClick={() => onDelete(order.id)}><TrashIcon /></button>}
                            {canCreate && order.status === "CREATED" && (
                              <button className="order-move-btn" onClick={() => moveToProduction(order)}>
                                Start Production
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                />
              </table>
            </div>
            <div className="order-pagination">
              <div className="order-pagination-info">Page {currentPage} of {totalPages}</div>
              <div className="order-page-controls">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
              </div>
            </div>
          </>
        ) : (
          <div className="order-empty-state">
            <div className="order-empty-icon"><BoxesIcon /></div>
            <p>No orders available</p>
            {canCreate && (
              <button
                className="order-btn-primary"
                onClick={() => {
                setEditingOrderId(null);
                setIsCreateModalOpen(true);
                setForm(createCreateForm());
              }}
            >
              Create Order
              </button>
            )}
          </div>
        )}
      </section>

      {selectedOrder && (
        <div className="order-modal-overlay">
          <div className="order-modal-card">
            <div className="order-modal-head">
              <div>
                <h3>Order Details</h3>
                <p>{getDisplaySalesGroupNumber(selectedOrder)} - {selectedOrder.clientName}</p>
              </div>
              <button className="order-modal-close-btn" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
            <div className="order-detail-grid">
              <p><span>Timestamp:</span> {formatDateTime(selectedOrder.createdAt || selectedOrder.orderDate)}</p>
              <p><span>Sales ID:</span> {getDisplaySalesGroupNumber(selectedOrder)}</p>
              <p><span>Order No:</span> {selectedOrder.orderNo}</p>
              <p><span>Product:</span> {selectedOrder.product}</p>
              <p><span>Grade:</span> {selectedOrder.grade}</p>
              <p><span>Quantity:</span> {selectedOrder.quantity}</p>
              <p><span>Price:</span> {formatPriceValue(selectedOrder.price)}</p>
              <p><span>Currency:</span> {selectedOrder.currency || "-"}</p>
              <p><span>Unit of Measurement:</span> {selectedOrder.unit}</p>
              <p><span>Expected Timeline:</span> {formatDate(selectedOrder.deliveryDate)}</p>
              <p><span>Client Code:</span> {getClientCode(selectedOrder.clientName, selectedOrder.id)}</p>
              <p><span>Client Name:</span> {selectedOrder.clientName || "-"}</p>
              <p><span>Sales Eng ID:</span> {selectedOrder.createdById || "-"}</p>
              <p><span>City:</span> {selectedOrderLocation?.city || "-"}</p>
              <p><span>Pincode:</span> {selectedOrderLocation?.pincode || "-"}</p>
              <p><span>State:</span> {selectedOrderLocation?.state || "-"}</p>
              <p><span>Address:</span> {selectedOrder.address || "-"}</p>
              <p><span>Country Code:</span> {selectedOrderLocation?.countryCode || "-"}</p>
              <p><span>Prod Status:</span> {getProductionStatusLabel(selectedOrder)}</p>
              <p><span>Prod Comp Date:</span> {formatDate(selectedOrder.production?.productionCompletionDate)}</p>
              <p><span>Dispatch Date:</span> {formatDate(getOrderDispatchDate(selectedOrder))}</p>
              <p><span>Status:</span> {getOrderStatusLabel(selectedOrder.status)}</p>
              <p><span>Remarks:</span> {selectedOrder.remarks || "-"}</p>
            </div>
            {canCreate && (
              <div className="order-form-actions">
                <button
                  type="button"
                  className="order-btn-secondary"
                  onClick={() => {
                    const current = selectedOrder;
                    setSelectedOrder(null);
                    if (current) onEdit(current);
                  }}
                >
                  Edit
                </button>
                <button type="button" className="order-btn-primary" onClick={() => setSelectedOrder(null)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isCreateModalOpen && canCreate && (
        <div className="order-modal-overlay">
          <div className="order-modal-card large">
            <div className="order-modal-head">
              <div>
                <h3>{editingOrderId ? "Edit Order" : "Create Manual Request"}</h3>
                <p>{editingOrderId ? "Update order entry." : "Submit a manual order request for approval."}</p>
              </div>
              <button
                className="order-modal-close-btn"
                onClick={() => setIsCreateModalOpen(false)}
                disabled={creating}
              >
                Close
              </button>
            </div>

            <form onSubmit={submitOrder} className="order-form-grid">
              <div>
                <label>Client Name</label>
                <input
                  list="customer-name-options"
                  value={form.client_name}
                  onChange={(e) => onCustomerChange(e.target.value)}
                  required
                />
                <datalist id="customer-name-options">
                  {customerMasterRows.map((row) => (
                    <option key={row.customerCode || row.customerName} value={row.customerName} />
                  ))}
                </datalist>
              </div>
              <div>
                <label>Customer Code</label>
                <input value={selectedCustomerProfile?.customerCode || ""} disabled />
              </div>
              {!editingOrderId ? (
                <>
                <div className="full-row">
                  <label>Products Requested*</label>
                  <div className="enquiry-product-rows">
                    {(form.products || []).map((row, index) => (
                      <div key={index} className="enquiry-product-row">
                        <div>
                          <label>Product</label>
                          <select
                            value={row.product}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                products: prev.products.map((item, rowIndex) =>
                                  rowIndex === index ? { ...item, product: event.target.value } : item
                                )
                              }))
                            }
                            required
                          >
                            <option value="">Select product</option>
                            {requestProductOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label>Grade</label>
                          <input
                            type="text"
                            value={row.grade}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                products: prev.products.map((item, rowIndex) =>
                                  rowIndex === index ? { ...item, grade: event.target.value } : item
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
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                products: prev.products.map((item, rowIndex) =>
                                  rowIndex === index ? { ...item, quantity: event.target.value } : item
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
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                products: prev.products.map((item, rowIndex) =>
                                  rowIndex === index ? { ...item, unit_of_measurement: event.target.value } : item
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
                <div className="full-row">
                  <label>Expected Timeline</label>
                  <input
                    type="date"
                    value={form.delivery_date}
                    onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))}
                    required
                  />
                </div>
                </>
              ) : (
                <>
                  <div>
                    <label>Product</label>
                    <select value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} required>
                      <option value="">Select product</option>
                      {productOptions.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Grade</label>
                    <input value={form.grade} onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))} required />
                  </div>
                  <div>
                    <label>Quantity</label>
                    <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} required />
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
                  <div>
                    <label>Unit</label>
                    <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}>
                      {orderUnitOptions.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Dispatch Date</label>
                    <input type="date" value={form.delivery_date} onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))} required />
                  </div>
                </>
              )}
              <div>
                <label>City</label>
                <input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} required />
              </div>
              <div>
                <label>Address</label>
                <input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
              </div>
              <div>
                <label>Pincode</label>
                <input value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))} required />
              </div>
              <div>
                <label>State</label>
                <input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} required />
              </div>
              <div>
                <label>Country Code</label>
                <select value={form.country_code} onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))} required>
                  {masterData.countryCodes.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div className="full-row">
                <label>Remarks</label>
                <textarea rows="2" value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
              </div>
              <div className="full-row order-form-actions">
                <button
                  type="button"
                  className="order-btn-secondary"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingOrderId(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button className="order-btn-primary" disabled={creating}>
                  {creating ? "Saving..." : editingOrderId ? "Save Changes" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderPage;
