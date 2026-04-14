import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axiosClient";
import { BoxesIcon } from "../../erp/ErpIcons";
import MobileCard from "../common/MobileCard";
import MobileFilterChips from "../common/MobileFilterChips";
import MobileHeader from "../common/MobileHeader";
import MobileSearchBar from "../common/MobileSearchBar";
import MobileStatusBadge from "../common/MobileStatusBadge";
import FloatingButton from "../common/FloatingButton";
import useMasterData from "../../../hooks/useMasterData";
import { logApiError } from "../../../utils/apiError";

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
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

function getProductionStatusLabel(order) {
  if (order.production?.status === "COMPLETED") return "Completed";
  if (order.production?.status === "IN_PROGRESS") return "In Progress";
  if (order.status === "DISPATCHED" || order.status === "COMPLETED") return "Completed";
  if (order.status === "IN_PRODUCTION") return "In Progress";
  return "Pending";
}

function getMissingLocationFields(order) {
  const missing = [];
  if (!(order.city || "").trim()) missing.push("City");
  if (!(order.pincode || "").trim()) missing.push("Pincode");
  if (!(order.state || "").trim()) missing.push("State");
  if (!(order.countryCode || "").trim()) missing.push("Country");
  return missing;
}

function OrdersMobileModule({ canCreate }) {
  const navigate = useNavigate();
  const masterData = useMasterData();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
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
  const customerMasterRows = useMemo(
    () => (Array.isArray(masterData.customerMaster) ? masterData.customerMaster : []),
    [masterData.customerMaster]
  );
  const filters = useMemo(
    () => [
      { value: "all", label: "All" },
      ...masterData.orderStatuses.map((item) => ({ value: item.value, label: item.label }))
    ],
    [masterData.orderStatuses]
  );

  const onCustomerChange = (customerName) => {
    const profile = customerMasterRows.find((item) => item.customerName === customerName);
    if (!profile) {
      setForm((prev) => ({ ...prev, client_name: customerName }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      client_name: customerName,
      address: profile.address || prev.address,
      city: profile.city || prev.city,
      pincode: profile.pincode || prev.pincode,
      state: profile.state || prev.state,
      country_code: profile.countryCode || prev.country_code
    }));
  };

  const fetchData = async (searchQuery = query, nextStatus = status) => {
    setLoading(true);
    try {
      const ordersRes = await api.get("/orders", { params: { q: searchQuery || undefined, status: nextStatus === "all" ? undefined : nextStatus } });
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

  const onSearch = () => {
    const nextQuery = searchText.trim();
    setQuery(nextQuery);
    fetchData(nextQuery, status);
  };

  const onSubmitOrder = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    setSaving(true);
    try {
      const payload = { ...form, quantity: Number(form.quantity) };
      if (editingOrderId) {
        await api.put(`/orders/${editingOrderId}`, payload);
      } else {
        await api.post("/orders", payload);
      }
      setIsModalOpen(false);
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
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save order");
    } finally {
      setSaving(false);
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
    setIsModalOpen(true);
  };

  const onDelete = async (id) => {
    if (!canCreate) return;
    if (!window.confirm("Delete this order?")) return;
    try {
      await api.delete(`/orders/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to delete order");
    }
  };

  const onMoveToProduction = async (order) => {
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

  return (
    <div className="mapp-module">
      <MobileHeader title="Orders" />
      <MobileSearchBar
        value={searchText}
        onChange={(event) => setSearchText(event.target.value)}
        onSubmit={onSearch}
        placeholder="Search orders, product, client"
      />
      <MobileFilterChips
        options={filters}
        value={status}
        onChange={(value) => {
          setStatus(value);
          fetchData(query, value);
        }}
      />

      <div className="mapp-list">
        {loading ? (
          [1, 2, 3].map((item) => <div key={item} className="mapp-skeleton-card" />)
        ) : orders.length ? (
          orders.map((order) => (
            <MobileCard key={order.id}>
              <div className="mapp-card-top">
                <h4>{order.salesOrderNumber}</h4>
                <MobileStatusBadge value={order.status} />
              </div>
              <p>{order.product} ({order.grade})</p>
              <p>{order.clientName}</p>
              <p>Client Code: {getClientCode(order.clientName, order.id)}</p>
              <div className="mapp-card-meta">
                <span>{order.quantity} {order.unit}</span>
                <span>{formatDate(order.deliveryDate)}</span>
              </div>
              <div className="mapp-card-meta">
                <span>{order.city || "-"}, {order.state || "-"}</span>
                <span>Prod: {getProductionStatusLabel(order)}</span>
              </div>
              <div className="mapp-card-actions">
                <button className="mapp-btn mapp-btn-ghost">View</button>
                {canCreate && <button className="mapp-btn mapp-btn-ghost" onClick={() => onEdit(order)}>Edit</button>}
                {canCreate && <button className="mapp-btn mapp-btn-danger" onClick={() => onDelete(order.id)}>Delete</button>}
                {canCreate && order.status === "CREATED" && (
                  <button className="mapp-btn mapp-btn-primary" onClick={() => onMoveToProduction(order)}>Start Production</button>
                )}
              </div>
            </MobileCard>
          ))
        ) : (
          <div className="mapp-empty">
            <BoxesIcon />
            <p>No orders available</p>
            {canCreate && <button className="mapp-btn mapp-btn-primary" onClick={() => setIsModalOpen(true)}>Create Order</button>}
          </div>
        )}
      </div>

      {canCreate && <FloatingButton label="Create Order" onClick={() => {
        setEditingOrderId(null);
        setIsModalOpen(true);
      }} />}

      {isModalOpen && (
        <div className="mapp-modal-overlay">
          <div className="mapp-modal">
            <h3>{editingOrderId ? "Edit Order" : "Create Order"}</h3>
            <form className="mapp-form" onSubmit={onSubmitOrder}>
              <label>Product</label>
              <input value={form.product} onChange={(event) => setForm((prev) => ({ ...prev, product: event.target.value }))} required />
              <label>Grade</label>
              <input value={form.grade} onChange={(event) => setForm((prev) => ({ ...prev, grade: event.target.value }))} required />
              <label>Quantity</label>
              <input type="number" min="1" value={form.quantity} onChange={(event) => setForm((prev) => ({ ...prev, quantity: event.target.value }))} required />
              <label>Client</label>
              <input list="mobile-customer-name-options" value={form.client_name} onChange={(event) => onCustomerChange(event.target.value)} required />
              <datalist id="mobile-customer-name-options">
                {customerMasterRows.map((row) => (
                  <option key={row.customerCode || row.customerName} value={row.customerName} />
                ))}
              </datalist>
              <label>Delivery Date</label>
              <input type="date" value={form.delivery_date} onChange={(event) => setForm((prev) => ({ ...prev, delivery_date: event.target.value }))} required />
              <label>City</label>
              <input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} required />
              <label>Address</label>
              <input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
              <label>Pincode</label>
              <input value={form.pincode} onChange={(event) => setForm((prev) => ({ ...prev, pincode: event.target.value }))} required />
              <label>State</label>
              <input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} required />
              <label>Country Code</label>
              <select value={form.country_code} onChange={(event) => setForm((prev) => ({ ...prev, country_code: event.target.value }))} required>
                {masterData.countryCodes.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <div className="mapp-form-actions">
                <button type="button" className="mapp-btn mapp-btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button className="mapp-btn mapp-btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrdersMobileModule;
