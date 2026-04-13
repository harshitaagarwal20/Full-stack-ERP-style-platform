import { useEffect, useMemo, useState } from "react";
import api from "../../../api/axiosClient";
import { TruckIcon } from "../../erp/ErpIcons";
import MobileCard from "../common/MobileCard";
import MobileFilterChips from "../common/MobileFilterChips";
import MobileHeader from "../common/MobileHeader";
import MobileSearchBar from "../common/MobileSearchBar";
import MobileStatusBadge from "../common/MobileStatusBadge";
import FloatingButton from "../common/FloatingButton";
import { logApiError } from "../../../utils/apiError";

const filters = [
  { value: "all", label: "All" },
  { value: "PACKING", label: "Pending" },
  { value: "SHIPPED", label: "In Transit" },
  { value: "DELIVERED", label: "Delivered" }
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function DispatchMobileModule({ canManage = false }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [readyOrders, setReadyOrders] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [form, setForm] = useState({
    dispatch_quantity: "",
    dispatch_date: "",
    shipment_status: "",
    packing_done: false,
    remarks: ""
  });

  const fetchData = async (searchQuery = query) => {
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
    fetchData("");
  }, []);

  const filteredDispatches = useMemo(() => (
    status === "all" ? dispatches : dispatches.filter((item) => item.shipmentStatus === status)
  ), [dispatches, status]);

  const onSearch = () => {
    const nextQuery = searchText.trim();
    setQuery(nextQuery);
    fetchData(nextQuery);
  };

  const dispatchNow = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!selectedOrder) return;
    if (!form.shipment_status) {
      return;
    }
    const dispatchQty = Number(form.dispatch_quantity);
    if (!dispatchQty || dispatchQty <= 0) {
      return;
    }
    setSaving(true);
    try {
      await api.post("/dispatch", {
        order_id: selectedOrder.id,
        dispatch_quantity: dispatchQty,
        dispatch_date: form.dispatch_date || null,
        packing_done: Boolean(form.packing_done),
        shipment_status: form.shipment_status,
        remarks: form.remarks || null
      });
      setSelectedOrder(null);
      await fetchData();
    } catch (error) {
      logApiError(error, "Dispatch failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mapp-module">
      <MobileHeader title="Dispatch" />
      <MobileSearchBar value={searchText} onChange={(event) => setSearchText(event.target.value)} onSubmit={onSearch} placeholder="Search order, client, product" />
      <MobileFilterChips options={filters} value={status} onChange={setStatus} />

      <div className="mapp-list">
        {!loading && readyOrders.length > 0 && (
          readyOrders.map((order) => (
            <MobileCard key={`ready-${order.id}`}>
              <div className="mapp-card-top">
                <h4>{order.salesOrderNumber}</h4>
                <MobileStatusBadge value="PENDING" />
              </div>
              <p>{order.product}</p>
              <p>{order.clientName}</p>
              <div className="mapp-card-meta">
                <span>{order.quantity} {order.unit}</span>
                <span>Remaining {order.remainingQuantity ?? order.quantity}</span>
              </div>
              <div className="mapp-card-actions">
                <button className="mapp-btn mapp-btn-ghost">View</button>
                {canManage && (
                  <button
                    className="mapp-btn mapp-btn-primary"
                    onClick={() => {
                      setSelectedOrder(order);
                      setForm((prev) => ({
                        ...prev,
                        dispatch_quantity: String(order.remainingQuantity ?? order.quantity ?? "")
                      }));
                    }}
                  >
                    Dispatch Now
                  </button>
                )}
              </div>
            </MobileCard>
          ))
        )}

        {loading ? (
          [1, 2, 3].map((item) => <div key={item} className="mapp-skeleton-card" />)
        ) : filteredDispatches.length ? (
          filteredDispatches.map((dispatch) => (
            <MobileCard key={dispatch.id}>
              <div className="mapp-card-top">
                <h4>{dispatch.order?.salesOrderNumber}</h4>
                <MobileStatusBadge value={dispatch.shipmentStatus} />
              </div>
              <p>{dispatch.order?.product}</p>
              <p>{dispatch.order?.clientName}</p>
              <div className="mapp-card-meta">
                <span>{formatDate(dispatch.dispatchDate)}</span>
                <span>{dispatch.dispatchedQuantity || 0} {dispatch.order?.unit || ""}</span>
              </div>
              <div className="mapp-card-actions">
                <button className="mapp-btn mapp-btn-ghost">View</button>
              </div>
            </MobileCard>
          ))
        ) : (
          <div className="mapp-empty">
            <TruckIcon />
            <p>No dispatch records yet</p>
            {canManage && (
              <button
                className="mapp-btn mapp-btn-primary"
                onClick={() => {
                  if (!readyOrders[0]) return;
                  setSelectedOrder(readyOrders[0]);
                  setForm((prev) => ({
                    ...prev,
                    dispatch_quantity: String(readyOrders[0].remainingQuantity ?? readyOrders[0].quantity ?? "")
                  }));
                }}
              >
                Add Dispatch
              </button>
            )}
          </div>
        )}
      </div>

      {canManage && (
        <FloatingButton
          label="Add Dispatch"
          onClick={() => {
            if (!readyOrders[0]) return;
            setSelectedOrder(readyOrders[0]);
            setForm((prev) => ({
              ...prev,
              dispatch_quantity: String(readyOrders[0].remainingQuantity ?? readyOrders[0].quantity ?? "")
            }));
          }}
        />
      )}

      {selectedOrder && canManage && (
        <div className="mapp-modal-overlay">
          <div className="mapp-modal">
            <h3>Dispatch Now</h3>
            <p className="mapp-modal-sub">{selectedOrder.salesOrderNumber}</p>
            <form className="mapp-form" onSubmit={dispatchNow}>
              <label>Dispatch Quantity</label>
              <input type="number" min="1" value={form.dispatch_quantity} onChange={(event) => setForm((prev) => ({ ...prev, dispatch_quantity: event.target.value }))} required />
              <label>Status</label>
              <select value={form.shipment_status} onChange={(event) => setForm((prev) => ({ ...prev, shipment_status: event.target.value }))} required>
                <option value="">Select status</option>
                <option value="PACKING">Pending</option>
                <option value="SHIPPED">In Transit</option>
                <option value="DELIVERED">Delivered</option>
              </select>
              <label>Dispatch Date</label>
              <input type="date" value={form.dispatch_date} onChange={(event) => setForm((prev) => ({ ...prev, dispatch_date: event.target.value }))} required />
              <div className="mapp-form-actions">
                <button type="button" className="mapp-btn mapp-btn-secondary" onClick={() => setSelectedOrder(null)}>Cancel</button>
                <button className="mapp-btn mapp-btn-primary" disabled={saving}>{saving ? "Saving..." : "Dispatch"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DispatchMobileModule;
