import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/axiosClient";
import { PrinterIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";
import { dispatchUserMessage } from "../utils/errorMessages";
import { getShipToLocation } from "../config/shipToLocations";

function formatDate(val) {
  if (!val) return "-";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// A PO line carries two different money figures, and conflating them is what
// made a freshly-raised PO look like it was worth zero:
//
//   ordered value  = qty ordered   × price/UOM  → what we committed to buy
//   received value = qty received  × price/UOM  → what we actually owe
//
// Tax is charged on what was actually received, so the payable is derived from
// the received value.
function calcOrderedTotal(item) {
  return Number(item.qty || 0) * Number(item.unitPrice || 0);
}

function calcReceivedTotal(item) {
  return Number(item.receivedQty || 0) * Number(item.unitPrice || 0);
}

function calcOrderedAfterTax(item) {
  return calcOrderedTotal(item) * (1 + (item.taxPercent || 0) / 100);
}

// What accounts actually pays for this line.
function calcPayableAfterTax(item) {
  return calcReceivedTotal(item) * (1 + (item.taxPercent || 0) / 100);
}

function formatDateTime(val) {
  return val ? new Date(val).toLocaleString() : "-";
}

function formatAmount(val) {
  if (val == null || val === "") return "-";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(val);
}

function getPOStatusClass(status) {
  if (status === "DRAFT") return "created";
  if (status === "SUBMITTED") return "partial";
  if (status === "APPROVED") return "ready";
  if (status === "SENT_TO_SUPPLIER") return "in-production";
  if (status === "PARTIALLY_RECEIVED") return "partial";
  if (status === "FULLY_RECEIVED") return "ready";
  if (status === "CLOSED") return "dispatched";
  return "created";
}

function getPOStatusLabel(status) {
  if (status === "DRAFT") return "Draft";
  if (status === "SUBMITTED") return "Submitted";
  if (status === "APPROVED") return "Approved";
  if (status === "SENT_TO_SUPPLIER") return "Sent to Supplier";
  if (status === "PARTIALLY_RECEIVED") return "Partially Received";
  if (status === "FULLY_RECEIVED") return "Fully Received";
  if (status === "CLOSED") return "Closed";
  return status;
}

function StatusActions({ po, onStatusChange, onDelete, navigateToEdit, navigateToGRN, isAdmin }) {
  const [updating, setUpdating] = useState(false);

  const doStatus = async (newStatus) => {
    if (updating) return;
    setUpdating(true);
    try {
      await onStatusChange(newStatus);
    } finally {
      setUpdating(false);
    }
  };

  const { status } = po;

  if (status === "DRAFT") {
    return (
      <>
        <button className="order-btn-secondary" onClick={navigateToEdit}>
          Edit PO
        </button>
        {isAdmin && (
          <button className="order-btn-primary" disabled={updating} onClick={() => doStatus("SENT_TO_SUPPLIER")}>
            Generate PO — Send to Supplier
          </button>
        )}
        {isAdmin && (
          <button
            className="order-btn-secondary po-btn-danger"
            disabled={updating}
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </>
    );
  }

  if (status === "SENT_TO_SUPPLIER" || status === "PARTIALLY_RECEIVED") {
    return (
      <button className="order-btn-primary ghost" onClick={navigateToGRN}>
        Create GRN
      </button>
    );
  }

  if (status === "FULLY_RECEIVED") {
    return (
      <button className="order-btn-primary" disabled={updating} onClick={() => doStatus("CLOSED")}>
        Close PO
      </button>
    );
  }

  return null;
}

function PurchaseOrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadPO = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/purchase-orders/${id}`);
      setPo(data);
    } catch (error) {
      logApiError(error, "Failed to load purchase order");
      navigate("/purchase-orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPO();
  }, [id]);

  const STATUS_SUCCESS_MSG = {
    SENT_TO_SUPPLIER: "Purchase order sent to supplier.",
    CLOSED: "Purchase order closed.",
  };

  const handleStatusChange = async (newStatus) => {
    try {
      await api.patch(`/purchase-orders/${id}/status`, { status: newStatus });
      dispatchUserMessage(STATUS_SUCCESS_MSG[newStatus] || "Status updated.", { title: "Updated", variant: "success" });
      await loadPO();
    } catch (error) {
      logApiError(error, "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this purchase order? This cannot be undone.")) return;
    try {
      await api.delete(`/purchase-orders/${id}`);
      dispatchUserMessage("Purchase order deleted.", { title: "Deleted", variant: "success" });
      navigate("/purchase-orders");
    } catch (error) {
      logApiError(error, "Failed to delete purchase order");
    }
  };

  if (loading) {
    return (
      <div className="order-page">
        <div className="order-skeleton-list">
          <div className="order-skeleton-row" />
          <div className="order-skeleton-row" />
        </div>
      </div>
    );
  }

  if (!po) return null;

  const grnItems = po.grns || [];
  const shipToLocation = getShipToLocation(po.shipTo);

  return (
    <div className="order-page">
      {/* Header */}
      <section className="order-card po-detail-header">
        <div className="po-detail-header-top">
          <button className="order-btn-secondary" onClick={() => navigate("/purchase-orders")}>
            ← Purchase Orders
          </button>
          <div className="po-detail-header-meta">
            <div className="po-detail-title-block">
              <div className="po-detail-number">{po.poNumber}</div>
              <div className="po-detail-supplier-name">{po.supplier?.name}</div>
            </div>
            <span className={`order-status ${getPOStatusClass(po.status)}`}>
              {getPOStatusLabel(po.status)}
            </span>
          </div>
        </div>
        <div className="po-detail-actions">
          <a
            href={`/purchase-orders/${id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="order-btn-secondary po-btn-print"
          >
            <PrinterIcon />
            Print PO
          </a>
          <StatusActions
            po={po}
            isAdmin={isAdmin}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
            navigateToEdit={() => navigate(`/purchase-orders/${id}/edit`)}
            navigateToGRN={() => navigate(`/grns/new?po_id=${id}`)}
          />
        </div>
      </section>

      {/* Info cards side by side */}
      <div className="po-detail-info-grid">
        <section className="order-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>Order Details</h3>
          <div className="order-detail-grid">
            <p><span>PO Number</span> {po.poNumber}</p>
            <p><span>Order Date</span> {formatDate(po.orderDate)}</p>
            <p><span>Exp. Delivery</span> {formatDate(po.expectedDeliveryDate)}</p>
            <p><span>Ship To</span> {shipToLocation.label}</p>
            {po.department && <p><span>Department</span> {po.department}</p>}
            <p><span>Total Amount</span> <strong>{formatAmount(po.totalAmount)}</strong></p>
            <p><span>Created By</span> {po.createdBy?.name || "-"}</p>
            {po.notes && <p style={{ gridColumn: "1 / -1" }}><span>Remarks</span> {po.notes}</p>}
          </div>
        </section>

        <section className="order-card" style={{ margin: 0 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.05em" }}>Supplier</h3>
          <div className="order-detail-grid">
            <p style={{ gridColumn: "1 / -1" }}><span>Name</span> <strong>{po.supplier?.name || "-"}</strong></p>
            {po.supplier?.supplierCode   && <p><span>Supplier Code</span> {po.supplier.supplierCode}</p>}
            {po.supplier?.contactPerson  && <p><span>Contact Person</span> {po.supplier.contactPerson}</p>}
            {po.supplier?.phone          && <p><span>Contact No.</span> {po.supplier.phone}</p>}
            {po.supplier?.gstNo          && <p><span>GST No.</span> {po.supplier.gstNo}</p>}
            {po.supplier?.panNo          && <p><span>PAN No.</span> {po.supplier.panNo}</p>}
            {po.supplier?.email          && <p><span>Email</span> {po.supplier.email}</p>}
            {po.supplier?.pincode        && <p><span>Pincode</span> {po.supplier.pincode}</p>}
            {po.supplier?.address        && <p style={{ gridColumn: "1 / -1" }}><span>Address</span> {po.supplier.address}</p>}
          </div>
        </section>
      </div>

      {/* Line Items */}
      <section className="order-card">
        <h3 style={{ margin: "0 0 14px", fontSize: 15, color: "#334155" }}>
          Line Items ({po.items?.length || 0})
        </h3>
        <div className="responsive-table-wrap">
          <table className="order-table responsive-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item ID</th>
                <th>Qty Ordered</th>
                <th>UoM</th>
                <th>Grade</th>
                <th>Currency</th>
                <th>Price / UoM</th>
                <th>Ordered Value</th>
                <th>Tax %</th>
                <th>Qty Received</th>
                <th>Received Value</th>
                <th>Payable (incl. tax)</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((item, index) => {
                const fullyReceived = Number(item.receivedQty || 0) >= Number(item.qty || 0);
                return (
                  <tr key={item.id}>
                    <td data-label="">{index + 1}</td>
                    <td data-label="Item ID">{item.itemId || "-"}</td>
                    <td data-label="Qty Ordered">{item.qty}</td>
                    <td data-label="UoM">{item.uom || "-"}</td>
                    <td data-label="Grade">{item.grade || "-"}</td>
                    <td data-label="Currency">{item.currency || "INR"}</td>
                    <td data-label="Price / UoM">{formatAmount(item.unitPrice)}</td>
                    <td data-label="Ordered Value">{formatAmount(calcOrderedTotal(item))}</td>
                    <td data-label="Tax %">{item.taxPercent != null ? `${item.taxPercent}%` : "-"}</td>
                    <td
                      data-label="Qty Received"
                      style={{ color: fullyReceived ? "#047857" : "#b45309", fontWeight: 600 }}
                    >
                      {item.receivedQty}
                    </td>
                    <td data-label="Received Value">{formatAmount(calcReceivedTotal(item))}</td>
                    <td data-label="Payable (incl. tax)" style={{ fontWeight: 600 }}>
                      {formatAmount(calcPayableAfterTax(item))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={7} style={{ textAlign: "right", fontWeight: 700, paddingRight: 12 }}>
                  PO Value (ordered, incl. tax)
                </td>
                <td data-label="PO Value (ordered, incl. tax)" colSpan={5} style={{ fontWeight: 700 }}>
                  {formatAmount((po.items || []).reduce((sum, item) => sum + calcOrderedAfterTax(item), 0))}
                </td>
              </tr>
              <tr>
                <td colSpan={7} style={{ textAlign: "right", fontWeight: 700, paddingRight: 12 }}>
                  Payable so far (received, incl. tax)
                </td>
                <td
                  data-label="Payable so far (received, incl. tax)"
                  colSpan={5}
                  style={{ fontWeight: 800, color: "#047857" }}
                >
                  {formatAmount((po.items || []).reduce((sum, item) => sum + calcPayableAfterTax(item), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style={{ margin: "10px 2px 0", fontSize: 12.5, color: "#64748b" }}>
          Prices are per UoM. <strong>Payable</strong> is calculated from the quantity actually
          received (received qty × price/UoM, plus tax), so it rises as goods arrive against
          this PO — it only equals the full PO value once everything is received.
        </p>
      </section>

      {/* Linked GRNs */}
      <section className="order-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: "#334155" }}>
            Linked Goods Receipt Notes ({grnItems.length})
          </h3>
          {(po.status === "SENT_TO_SUPPLIER" || po.status === "PARTIALLY_RECEIVED") && (
            <button
              className="order-btn-primary ghost"
              onClick={() => navigate(`/grns/new?po_id=${id}`)}
            >
              + Create GRN
            </button>
          )}
        </div>

        {grnItems.length === 0 ? (
          <div className="order-empty-state" style={{ padding: "24px 0" }}>
            <p style={{ color: "#64748b", margin: 0 }}>No GRNs received yet</p>
          </div>
        ) : (
          <div className="responsive-table-wrap">
            <table className="order-table responsive-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>GRN Number</th>
                  <th>Status</th>
                  <th>Received Date</th>
                  <th>Warehouse</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {grnItems.map((grn, index) => (
                  <tr
                    key={grn.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/grns/${grn.id}`)}
                  >
                    <td data-label="">{index + 1}</td>
                    <td data-label="GRN Number" style={{ color: "#2563eb", fontWeight: 600 }}>{grn.grnNumber}</td>
                    <td data-label="Status">
                      <span className={`order-status ${grn.status === "CONFIRMED" ? "approved" : "created"}`}>
                        {grn.status === "CONFIRMED" ? "Confirmed" : "Draft"}
                      </span>
                    </td>
                    <td data-label="Received Date">{formatDate(grn.receivedDate)}</td>
                    <td data-label="Warehouse">{grn.warehouseLocation || "-"}</td>
                    <td data-label="Created At">{formatDateTime(grn.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default PurchaseOrderDetailPage;
