import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import MobileListCard from "../components/common/MobileListCard";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { findCustomerProfile } from "../utils/customerLookup";
import { formatPriceValue } from "../utils/commerce";
import { getDisplaySalesNumber } from "../utils/businessNumbers";
import { sortByNewestFirst } from "../utils/recordOrdering";
import { exportRowsToExcel } from "../utils/exportExcel";

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
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

function PendingExportDatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const masterData = useMasterData();
  const canEditDispatchDate = ["admin", "dispatch"].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [savingDispatchDate, setSavingDispatchDate] = useState(false);
  const [dispatchDateOrders, setDispatchDateOrders] = useState([]);
  const [selectedDispatchOrder, setSelectedDispatchOrder] = useState(null);
  const [dispatchDateValue, setDispatchDateValue] = useState("");
  const isMobile = useIsMobile();
  const tableWrapRef = useRef(null);
  const customerMasterRows = Array.isArray(masterData.customerMaster) ? masterData.customerMaster : [];

  const fetchDispatchDateOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dispatch");
      setDispatchDateOrders(sortByNewestFirst(Array.isArray(data?.dispatchDateOrders) ? data.dispatchDateOrders : []));
    } catch (error) {
      logApiError(error, "Failed to load approved requests pending dispatch date");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDispatchDateOrders();
  }, []);

  const openDispatchDateModal = (order) => {
    if (!canEditDispatchDate) return;
    setSelectedDispatchOrder(order);
    setDispatchDateValue(order.dispatchDate ? new Date(order.dispatchDate).toISOString().slice(0, 10) : "");
  };

  const getResolvedLocation = (order) => {
    const profile = findCustomerProfile(customerMasterRows, order?.clientName);
    return {
      city: (order?.city || profile?.city || "").trim(),
      pincode: (order?.pincode || profile?.pincode || "").trim(),
      state: (order?.state || profile?.state || "").trim(),
      countryCode: (order?.countryCode || profile?.countryCode || "").trim()
    };
  };

  const saveDispatchDate = async (event) => {
    event.preventDefault();
    if (!canEditDispatchDate || !selectedDispatchOrder || !dispatchDateValue) return;

    try {
      setSavingDispatchDate(true);
      const endpoint = selectedDispatchOrder.source === "MANUAL_REQUEST"
        ? `/dispatch/dispatch-date/manual/${selectedDispatchOrder.id}`
        : `/dispatch/dispatch-date/${selectedDispatchOrder.id}`;
      await api.put(endpoint, {
        dispatch_date: dispatchDateValue
      });
      setSelectedDispatchOrder(null);
      setDispatchDateValue("");
      await fetchDispatchDateOrders();
      navigate("/orders");
    } catch (error) {
      logApiError(error, "Failed to create order from approved enquiry");
    } finally {
      setSavingDispatchDate(false);
    }
  };

  const selectedDispatchSummary = selectedDispatchOrder ? {
    sourceLabel: selectedDispatchOrder.source === "MANUAL_REQUEST" ? "Manual Request" : "Enquiry",
    clientCode: getClientCode(selectedDispatchOrder.clientName, selectedDispatchOrder.id),
    packagingSize: selectedDispatchOrder.packingSize || "-",
    salesOrderNumber: getDisplaySalesNumber(selectedDispatchOrder) || "-",
    product: selectedDispatchOrder.product || "-",
    quantity: selectedDispatchOrder.quantity || 0,
    price: formatPriceValue(selectedDispatchOrder.price),
    currency: selectedDispatchOrder.currency || "-",
    unit: selectedDispatchOrder.unit || "-",
    expectedDeliveryDate: formatDate(selectedDispatchOrder.deliveryDate),
    ...(() => {
      const location = getResolvedLocation(selectedDispatchOrder);
      return {
        city: location.city || "-",
        pincode: location.pincode || "-",
        state: location.state || "-",
        countryCode: location.countryCode || "-"
      };
    })()
  } : null;

  const exportToExcel = () => {
    const columns = [
      { key: "salesId",      header: "Sales ID" },
      { key: "client",       header: "Client" },
      { key: "source",       header: "Source" },
      { key: "product",      header: "Product" },
      { key: "quantity",     header: "Quantity" },
      { key: "price",        header: "Price" },
      { key: "currency",     header: "Currency" },
      { key: "unit",         header: "Unit" },
      { key: "deliveryDate", header: "Expected Delivery Date" }
    ];
    const rows = dispatchDateOrders.map((order) => ({
      salesId:      getDisplaySalesNumber(order) || "-",
      client:       order.clientName || "-",
      source:       order.source === "MANUAL_REQUEST" ? "Manual Request" : "Enquiry",
      product:      order.product || "-",
      quantity:     order.quantity || 0,
      price:        formatPriceValue(order.price),
      currency:     order.currency || "-",
      unit:         order.unit || "-",
      deliveryDate: formatDate(order.deliveryDate)
    }));
    exportRowsToExcel("pending-dispatch-date", columns, rows);
  };

  return (
    <div className="dispatch-page">
      <section className="dispatch-card">
        <div className="dispatch-section-head">
          <h2>Approved Requests Pending Dispatch Date</h2>
          <button className="order-btn-secondary" onClick={exportToExcel}>
            Export to Excel
          </button>
        </div>

        {loading ? (
          <div className="dispatch-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="dispatch-skeleton-row" />)}
          </div>
        ) : dispatchDateOrders.length ? (
          <>
          {!isMobile && <div className="dispatch-table-wrap" ref={tableWrapRef}>
            <table className="dispatch-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sales ID</th>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Price</th>
                  <th>Currency</th>
                  <th>Unit</th>
                  <th>Expected Delivery Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <VirtualizedTableBody
                rows={dispatchDateOrders}
                colSpan={10}
                rowHeight={52}
                overscan={8}
                scrollContainerRef={tableWrapRef}
                getRowKey={(order, index) => order.id || index}
                renderRow={(order, index, key) => (
                  <tr key={key}>
                    <td>{index + 1}</td>
                    <td>{getDisplaySalesNumber(order)}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        <span>{order.clientName || "-"}</span>
                        <span className="text-[11px] uppercase tracking-wide text-slate-500">
                          {order.source === "MANUAL_REQUEST" ? "Manual Request" : "Enquiry"}
                        </span>
                      </div>
                    </td>
                    <td>{order.product || "-"}</td>
                    <td>{order.quantity || 0}</td>
                    <td>{formatPriceValue(order.price)}</td>
                    <td>{order.currency || "-"}</td>
                    <td>{order.unit || "-"}</td>
                    <td>{formatDate(order.deliveryDate)}</td>
                    <td>
                      {canEditDispatchDate && (
                        <button className="dispatch-btn-primary" onClick={() => openDispatchDateModal(order)}>
                          Set Dispatch Date
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              />
            </table>
          </div>}

          {isMobile && <div className="order-mobile-list">
            {dispatchDateOrders.map((order) => (
              <MobileListCard
                key={order.id}
                title={getDisplaySalesNumber(order) || "-"}
                subtitle={order.clientName || "-"}
                badge={order.source === "MANUAL_REQUEST" ? "Manual Request" : "Enquiry"}
                badgeColor="default"
                fields={[
                  { label: "Product", value: order.product || "-" },
                  { label: "Quantity", value: `${order.quantity || 0} ${order.unit || ""}` },
                  { label: "Price", value: formatPriceValue(order.price) },
                  { label: "Expected Delivery", value: formatDate(order.deliveryDate) }
                ]}
                onClick={() => canEditDispatchDate && openDispatchDateModal(order)}
                onActionClick={() => canEditDispatchDate && openDispatchDateModal(order)}
                actionLabel="Set Dispatch Date"
              />
            ))}
          </div>}
          </>
        ) : (
          <div className="dispatch-empty-state compact">
            <p>No approved enquiries or manual orders are waiting for dispatch date.</p>
          </div>
        )}
      </section>

      {selectedDispatchOrder && canEditDispatchDate && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal-card">
            <div className="dispatch-modal-head">
              <div>
                <h3>Set Dispatch Date & Create Order</h3>
                <p>{selectedDispatchSummary?.sourceLabel} - {getDisplaySalesNumber(selectedDispatchOrder)} - {selectedDispatchOrder.clientName}</p>
              </div>
              <button
                className="dispatch-modal-close"
                onClick={() => setSelectedDispatchOrder(null)}
                disabled={savingDispatchDate}
              >
                Close
              </button>
            </div>

            <form className="dispatch-form-grid" onSubmit={saveDispatchDate}>
              {selectedDispatchSummary && (
                <div className="full-row">
                  <div className="dispatch-summary-grid">
                    <p><span>Source:</span> {selectedDispatchSummary.sourceLabel}</p>
                    <p><span>Client Code:</span> {selectedDispatchSummary.clientCode}</p>
                    <p><span>Packaging Size:</span> {selectedDispatchSummary.packagingSize}</p>
                    <p><span>Sales ID:</span> {selectedDispatchSummary.salesOrderNumber}</p>
                    <p><span>Product:</span> {selectedDispatchSummary.product}</p>
                    <p><span>Quantity:</span> {selectedDispatchSummary.quantity}</p>
                    <p><span>Price:</span> {selectedDispatchSummary.price}</p>
                    <p><span>Currency:</span> {selectedDispatchSummary.currency}</p>
                    <p><span>Unit of Measurement:</span> {selectedDispatchSummary.unit}</p>
                    <p><span>Expected Delivery Date:</span> {selectedDispatchSummary.expectedDeliveryDate}</p>
                    <p><span>City:</span> {selectedDispatchSummary.city}</p>
                    <p><span>Pincode:</span> {selectedDispatchSummary.pincode}</p>
                    <p><span>State:</span> {selectedDispatchSummary.state}</p>
                    <p><span>Country Code:</span> {selectedDispatchSummary.countryCode}</p>
                  </div>
                </div>
              )}
              <div>
                <label>Dispatch Date</label>
                <input
                  type="date"
                  value={dispatchDateValue}
                  onChange={(event) => setDispatchDateValue(event.target.value)}
                  required
                />
              </div>
              <div className="full-row dispatch-form-actions">
                <button
                  type="button"
                  className="dispatch-btn-secondary"
                  onClick={() => setSelectedDispatchOrder(null)}
                  disabled={savingDispatchDate}
                >
                  Cancel
                </button>
                <button className="dispatch-btn-primary" disabled={savingDispatchDate}>
                  {savingDispatchDate ? "Saving..." : "Create Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PendingExportDatePage;
