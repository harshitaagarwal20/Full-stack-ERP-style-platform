import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import OrdersMobileModule from "../components/mobile/modules/OrdersMobileModule";
import { BoxesIcon, EditIcon, EyeIcon, FactoryIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useIsMobile from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";

const statusFilterOptions = [
  { value: "all", label: "All Status" },
  { value: "CREATED", label: "Created" },
  { value: "IN_PRODUCTION", label: "In Production" },
  { value: "DISPATCHED", label: "Dispatched" },
  { value: "COMPLETED", label: "Completed" }
];

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
  if (status === "DISPATCHED" || status === "COMPLETED") return "dispatched";
  if (status === "APPROVED") return "approved";
  return "created";
}

function getOrderStatusLabel(status) {
  if (status === "IN_PRODUCTION") return "In Production";
  if (status === "DISPATCHED") return "Dispatched";
  if (status === "COMPLETED") return "Completed";
  if (status === "APPROVED") return "Approved";
  return "Created";
}

function getProductionStatusLabel(order) {
  if (order.production?.status === "COMPLETED") return "Completed";
  if (order.production?.status === "IN_PROGRESS") return "In Progress";
  if (order.status === "DISPATCHED" || order.status === "COMPLETED") return "Completed";
  if (order.status === "IN_PRODUCTION") return "In Progress";
  return "Pending";
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

function getMissingLocationFields(order) {
  const missing = [];
  if (!(order.city || "").trim()) missing.push("City");
  if (!(order.pincode || "").trim()) missing.push("Pincode");
  if (!(order.state || "").trim()) missing.push("State");
  if (!(order.countryCode || "").trim()) missing.push("Country");
  return missing;
}

function OrderPage() {
  const PAGE_SIZE = 10;
  const navigate = useNavigate();
  const { user } = useAuth();
  const isMobile = useIsMobile();
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
  const [form, setForm] = useState({
    product: "",
    grade: "",
    quantity: "",
    unit: "KG",
    packing_type: "",
    packing_size: "",
    delivery_date: "",
    client_name: "",
    address: "",
    city: "",
    pincode: "",
    state: "",
    country_code: "IN",
    remarks: ""
  });

  const fetchData = async (searchQuery = query, status = statusFilter) => {
    setLoading(true);
    try {
      const ordersRes = await api.get("/orders", {
        params: {
          q: searchQuery || undefined,
          status: status === "all" ? undefined : status
        }
      });
      setOrders(ordersRes.data || []);
    } catch (error) {
      logApiError(error, "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData("", "all");
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesClient = clientFilter
        ? (order.clientName || "").toLowerCase().includes(clientFilter.toLowerCase())
        : true;
      const matchesDate = dateFilter ? new Date(order.deliveryDate).toISOString().slice(0, 10) === dateFilter : true;
      return matchesClient && matchesDate;
    });
  }, [orders, clientFilter, dateFilter]);

  const sortedOrders = useMemo(() => {
    const sorted = [...filteredOrders];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (order) => {
      if (key === "createdAt") return new Date(order.createdAt || order.orderDate || 0).getTime();
      if (key === "salesOrderNumber") return String(order.salesOrderNumber || "").toLowerCase();
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
  }, [filteredOrders, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedOrders.length / PAGE_SIZE));

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sortedOrders.slice(start, start + PAGE_SIZE);
  }, [sortedOrders, currentPage]);

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
    fetchData(nextQuery, statusFilter);
  };

  const submitOrder = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity)
      };

      if (editingOrderId) {
        await api.put(`/orders/${editingOrderId}`, payload);
      } else {
        await api.post("/orders", payload);
      }
      setForm({
        product: "",
        grade: "",
        quantity: "",
        unit: "KG",
        packing_type: "",
        packing_size: "",
        delivery_date: "",
        client_name: "",
        address: "",
        city: "",
        pincode: "",
        state: "",
        country_code: "IN",
        remarks: ""
      });
      setEditingOrderId(null);
      setIsCreateModalOpen(false);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save order");
    } finally {
      setCreating(false);
    }
  };

  const exportOrders = () => {
    exportRowsToExcel(
      `orders_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "timestamp", header: "Timestamp" },
        { key: "salesOrderNumber", header: "Sales Order" },
        { key: "orderNo", header: "Order No" },
        { key: "enquiryId", header: "Enquiry ID" },
        { key: "product", header: "Product" },
        { key: "grade", header: "Grade" },
        { key: "quantity", header: "Qty" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "packagingType", header: "Packaging Type" },
        { key: "packagingSize", header: "Packaging Size" },
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
        { key: "exportDate", header: "Export Date" },
        { key: "status", header: "Order Status" }
      ],
      filteredOrders.map((order) => ({
        timestamp: formatDateTime(order.createdAt || order.orderDate),
        salesOrderNumber: order.salesOrderNumber,
        orderNo: order.orderNo,
        enquiryId: order.enquiryId,
        product: order.product,
        grade: order.grade,
        quantity: order.quantity,
        unit: order.unit,
        packagingType: order.packingType || "-",
        packagingSize: order.packingSize || "-",
        expectedTimeline: formatDate(order.deliveryDate),
        clientName: order.clientName,
        clientCode: getClientCode(order.clientName, order.id),
        address: order.address || "-",
        city: order.city || "-",
        pincode: order.pincode || "-",
        state: order.state || "-",
        countryCode: order.countryCode || "-",
        prodStatus: getProductionStatusLabel(order),
        prodCompDate: formatDate(order.production?.productionCompletionDate),
        exportDate: formatDate(getOrderExportDate(order)),
        status: getOrderStatusLabel(order.status)
      }))
    );
  };

  const moveToProduction = async (order) => {
    if (!canCreate) return;
    const missing = getMissingLocationFields(order);
    if (missing.length > 0) {
      window.alert(`Fill these fields before starting production: ${missing.join(", ")}.`);
      return;
    }

    try {
      await api.post("/production", { order_id: order.id });
      await fetchData();
      navigate("/production");
    } catch (error) {
      logApiError(error, "Failed to start production");
    }
  };

  const onEdit = (order) => {
    if (!canCreate) return;
    setEditingOrderId(order.id);
    setForm({
      product: order.product || "",
      grade: order.grade || "",
      quantity: order.quantity ? String(order.quantity) : "",
      unit: order.unit || "KG",
      packing_type: order.packingType || "",
      packing_size: order.packingSize || "",
      delivery_date: order.deliveryDate ? new Date(order.deliveryDate).toISOString().slice(0, 10) : "",
      client_name: order.clientName || "",
      address: order.address || "",
      city: order.city || "",
      pincode: order.pincode || "",
      state: order.state || "",
      country_code: order.countryCode || "IN",
      remarks: order.remarks || ""
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

  if (isMobile) {
    return <OrdersMobileModule canCreate={canCreate} />;
  }

  return (
    <div className="order-page">
      <section className="order-card order-header-card">
        <h2>Order Module</h2>
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
                setForm({
                  product: "",
                  grade: "",
                  quantity: "",
                  unit: "KG",
                  packing_type: "",
                  packing_size: "",
                  delivery_date: "",
                  client_name: "",
                  address: "",
                  city: "",
                  pincode: "",
                  state: "",
                  country_code: "IN",
                  remarks: ""
                });
                setIsCreateModalOpen(true);
              }}
            >
              Create Manual Order
            </button>
          )}
        </div>
      </section>

      <section className="order-card">
        <div className="order-toolbar">
          <div className="order-filter-grid">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Filter by client"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
            />
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
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
        ) : filteredOrders.length ? (
          <>
            <div className="order-table-wrap">
              <div className="order-table-meta">
                Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, sortedOrders.length)}-
                {Math.min(currentPage * PAGE_SIZE, sortedOrders.length)} of {sortedOrders.length} records
              </div>
              <table className="order-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("createdAt")}>Timestamp</button></th>
                    <th><button className="order-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales Order</button></th>
                    <th>Enquiry ID</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th>Grade</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("quantity")}>Qty</button></th>
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
                    <th>Export Date</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("status")}>Order Status</button></th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, index) => (
                    <tr key={order.id}>
                      <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                      <td>{formatDateTime(order.createdAt || order.orderDate)}</td>
                      <td>{order.salesOrderNumber}</td>
                      <td>{order.enquiryId || "-"}</td>
                      <td>{order.product}</td>
                      <td>{order.grade || "-"}</td>
                      <td>{order.quantity}</td>
                      <td>{order.unit}</td>
                      <td>{formatDate(order.deliveryDate)}</td>
                      <td>{order.clientName || "-"}</td>
                      <td>{getClientCode(order.clientName, order.id)}</td>
                      <td>{order.city || "-"}</td>
                      <td>{order.pincode || "-"}</td>
                      <td>{order.state || "-"}</td>
                      <td>{order.countryCode || "-"}</td>
                      <td>{getProductionStatusLabel(order)}</td>
                      <td>{formatDate(order.production?.productionCompletionDate)}</td>
                      <td>{formatDate(getOrderExportDate(order))}</td>
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
                  ))}
                </tbody>
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
                <p>{selectedOrder.salesOrderNumber} - {selectedOrder.clientName}</p>
              </div>
              <button className="order-modal-close-btn" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
            <div className="order-detail-grid">
              <p><span>Timestamp:</span> {formatDateTime(selectedOrder.createdAt || selectedOrder.orderDate)}</p>
              <p><span>Sales Order Number:</span> {selectedOrder.salesOrderNumber}</p>
              <p><span>Order Number:</span> {selectedOrder.orderNo}</p>
              <p><span>Enquiry ID:</span> {selectedOrder.enquiryId || "-"}</p>
              <p><span>Product:</span> {selectedOrder.product}</p>
              <p><span>Grade:</span> {selectedOrder.grade}</p>
              <p><span>Qty:</span> {selectedOrder.quantity}</p>
              <p><span>Unit of Measurement:</span> {selectedOrder.unit}</p>
              <p><span>Expected Timeline:</span> {formatDate(selectedOrder.deliveryDate)}</p>
              <p><span>Client Code:</span> {getClientCode(selectedOrder.clientName, selectedOrder.id)}</p>
              <p><span>Client Name:</span> {selectedOrder.clientName || "-"}</p>
              <p><span>Assigned To:</span> {selectedOrder.enquiry?.assignedPerson || "-"}</p>
              <p><span>Sales Eng ID:</span> {selectedOrder.createdById || "-"}</p>
              <p><span>Enquiry Date:</span> {formatDateTime(selectedOrder.enquiry?.createdAt)}</p>
              <p><span>Packaging Type:</span> {selectedOrder.packingType || "-"}</p>
              <p><span>Packaging Size:</span> {selectedOrder.packingSize || "-"}</p>
              <p><span>City:</span> {selectedOrder.city || "-"}</p>
              <p><span>Pincode:</span> {selectedOrder.pincode || "-"}</p>
              <p><span>State:</span> {selectedOrder.state || "-"}</p>
              <p><span>Address:</span> {selectedOrder.address || "-"}</p>
              <p><span>Country Code:</span> {selectedOrder.countryCode || "-"}</p>
              <p><span>Prod Status:</span> {getProductionStatusLabel(selectedOrder)}</p>
              <p><span>Prod Comp Date:</span> {formatDate(selectedOrder.production?.productionCompletionDate)}</p>
              <p><span>Export Date:</span> {formatDate(getOrderExportDate(selectedOrder))}</p>
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
                <h3>{editingOrderId ? "Edit Order" : "Create Order"}</h3>
                <p>{editingOrderId ? "Update order entry." :""}</p>
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
                <input value={form.client_name} onChange={(e) => setForm((p) => ({ ...p, client_name: e.target.value }))} required />
              </div>
              <div>
                <label>Product</label>
                <input value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} required />
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
                <label>Unit</label>
                <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}>
                  <option value="KG">KG</option>
                  <option value="MT">MT</option>
                  <option value="LTR">LTR</option>
                </select>
              </div>
              <div>
                <label>Packing Type</label>
                <input value={form.packing_type} onChange={(e) => setForm((p) => ({ ...p, packing_type: e.target.value }))} required />
              </div>
              <div>
                <label>Packing Size</label>
                <input value={form.packing_size} onChange={(e) => setForm((p) => ({ ...p, packing_size: e.target.value }))} required />
              </div>
              <div>
                <label>Delivery Date</label>
                <input type="date" value={form.delivery_date} onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))} required />
              </div>
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
                <input value={form.country_code} onChange={(e) => setForm((p) => ({ ...p, country_code: e.target.value }))} required />
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
                  {creating ? "Saving..." : editingOrderId ? "Save Changes" : "Create Order"}
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
