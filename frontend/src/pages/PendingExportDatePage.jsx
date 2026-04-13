import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { logApiError } from "../utils/apiError";

function formatDate(dateValue) {
  return dateValue ? new Date(dateValue).toLocaleDateString() : "-";
}

function PendingExportDatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canEditExportDate = ["admin", "dispatch"].includes(user?.role);
  const [loading, setLoading] = useState(true);
  const [savingExportDate, setSavingExportDate] = useState(false);
  const [exportDateOrders, setExportDateOrders] = useState([]);
  const [selectedExportOrder, setSelectedExportOrder] = useState(null);
  const [exportDateValue, setExportDateValue] = useState("");

  const fetchExportDateOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/dispatch");
      setExportDateOrders(data.exportDateOrders || []);
    } catch (error) {
      logApiError(error, "Failed to load approved enquiries pending export date");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExportDateOrders();
  }, []);

  const openExportDateModal = (order) => {
    if (!canEditExportDate) return;
    setSelectedExportOrder(order);
    setExportDateValue(order.exportDate ? new Date(order.exportDate).toISOString().slice(0, 10) : "");
  };

  const saveExportDate = async (event) => {
    event.preventDefault();
    if (!canEditExportDate || !selectedExportOrder || !exportDateValue) return;

    try {
      setSavingExportDate(true);
      await api.put(`/dispatch/export-date/${selectedExportOrder.id}`, {
        export_date: exportDateValue
      });
      setSelectedExportOrder(null);
      setExportDateValue("");
      await fetchExportDateOrders();
      navigate("/orders");
    } catch (error) {
      logApiError(error, "Failed to create order from approved enquiry");
    } finally {
      setSavingExportDate(false);
    }
  };

  return (
    <div className="dispatch-page">
      <section className="dispatch-card">
        <div className="dispatch-section-head">
          <h2>Approved Enquiries </h2>
        </div>

        {loading ? (
          <div className="dispatch-skeleton-list">
            {[1, 2, 3].map((item) => <div key={item} className="dispatch-skeleton-row" />)}
          </div>
        ) : exportDateOrders.length ? (
          <div className="dispatch-table-wrap">
            <table className="dispatch-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Sales Order No</th>
                  <th>Client</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                  <th>Expected Delivery Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {exportDateOrders.map((order, index) => (
                  <tr key={order.id}>
                    <td>{index + 1}</td>
                    <td>{order.salesOrderNumber}</td>
                    <td>{order.clientName || "-"}</td>
                    <td>{order.product || "-"}</td>
                    <td>{order.quantity || 0}</td>
                    <td>{order.unit || "-"}</td>
                    <td>{formatDate(order.deliveryDate)}</td>
                    <td>
                      {canEditExportDate && (
                        <button className="dispatch-btn-primary" onClick={() => openExportDateModal(order)}>
                          Set Export Date
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dispatch-empty-state compact">
            <p>No approved enquiries are waiting for export date.</p>
          </div>
        )}
      </section>

      {selectedExportOrder && canEditExportDate && (
        <div className="dispatch-modal-overlay">
          <div className="dispatch-modal-card">
            <div className="dispatch-modal-head">
              <div>
                <h3>Set Export Date & Create Order</h3>
                <p>{selectedExportOrder.salesOrderNumber} - {selectedExportOrder.clientName}</p>
              </div>
              <button
                className="dispatch-modal-close"
                onClick={() => setSelectedExportOrder(null)}
                disabled={savingExportDate}
              >
                Close
              </button>
            </div>

            <form className="dispatch-form-grid" onSubmit={saveExportDate}>
              <div>
                <label>Export Date</label>
                <input
                  type="date"
                  value={exportDateValue}
                  onChange={(event) => setExportDateValue(event.target.value)}
                  required
                />
              </div>
              <div className="full-row dispatch-form-actions">
                <button
                  type="button"
                  className="dispatch-btn-secondary"
                  onClick={() => setSelectedExportOrder(null)}
                  disabled={savingExportDate}
                >
                  Cancel
                </button>
                <button className="dispatch-btn-primary" disabled={savingExportDate}>
                  {savingExportDate ? "Saving..." : "Create Order"}
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
