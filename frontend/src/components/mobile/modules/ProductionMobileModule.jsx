import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/axiosClient";
import { EditIcon, EyeIcon, FactoryIcon } from "../../erp/ErpIcons";
import MobileCard from "../common/MobileCard";
import MobileFilterChips from "../common/MobileFilterChips";
import MobileHeader from "../common/MobileHeader";
import MobileSearchBar from "../common/MobileSearchBar";
import MobileStatusBadge from "../common/MobileStatusBadge";
import { logApiError } from "../../../utils/apiError";

const filters = [
  { value: "all", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" }
];

const productionStatusOptions = [
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" }
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
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

function ProductionMobileModule({ canManage = false }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form, setForm] = useState({
    delivery_date: "",
    capacity: "",
    remarks: "",
    status: "PENDING"
  });

  const fetchData = async (searchQuery = query, nextStatus = status) => {
    setLoading(true);
    try {
      const recordsRes = await api.get("/production", { params: { q: searchQuery || undefined, status: nextStatus === "all" ? undefined : nextStatus } });
      setRecords(recordsRes.data || []);
    } catch (error) {
      logApiError(error, "Failed to load production data");
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

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canManage || !editingId) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        capacity: Number(form.capacity)
      };
      await api.put(`/production/${editingId}/edit`, payload);
      setIsModalOpen(false);
      setEditingId(null);
      setEditingRecord(null);
      setForm({
        delivery_date: "",
        capacity: "",
        remarks: "",
        status: "PENDING"
      });
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save production");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (record) => {
    if (!canManage) return;
    setEditingId(record.id);
    setEditingRecord(record);
    setForm({
      delivery_date: record.deliveryDate ? new Date(record.deliveryDate).toISOString().slice(0, 10) : "",
      capacity: record.capacity ? String(record.capacity) : "",
      remarks: record.remarks || "",
      status: record.status || "PENDING"
    });
    setIsModalOpen(true);
  };

  const onDelete = async (id) => {
    if (!canManage) return;
    if (!window.confirm("Delete this production record?")) return;
    try {
      await api.delete(`/production/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to delete production");
    }
  };

  return (
    <div className="mapp-module">
      <MobileHeader title="Production" />
      <MobileSearchBar value={searchText} onChange={(event) => setSearchText(event.target.value)} onSubmit={onSearch} placeholder="Search order, product, user" />
      <MobileFilterChips options={filters} value={status} onChange={(value) => { setStatus(value); fetchData(query, value); }} />

      <div className="mapp-list">
        {loading ? (
          [1, 2, 3].map((item) => <div key={item} className="mapp-skeleton-card" />)
        ) : records.length ? (
          records.map((record) => (
            <MobileCard key={record.id}>
              <div className="mapp-card-top">
                <h4>{record.order?.orderNo}</h4>
                <MobileStatusBadge value={record.status} />
              </div>
              <p>{record.order?.enquiry?.product}</p>
              <p>{record.assignedPersonnel}</p>
              <div className="mapp-card-meta">
                <span>{record.order?.enquiry?.quantity}</span>
                <span>{formatDate(record.createdAt)}</span>
              </div>
              <div className="mapp-card-actions">
                <button className="icon-btn" onClick={() => setSelectedRecord(record)} aria-label="View production record" title="View production record">
                  <EyeIcon />
                </button>
                {canManage && <button className="icon-btn" onClick={() => onEdit(record)} aria-label="Edit production record" title="Edit production record"><EditIcon /></button>}
                {canManage && record.status !== "COMPLETED" && (
                  <button className="mapp-btn mapp-btn-primary" onClick={() => navigate(`/production/complete/${record.id}`)}>Complete</button>
                )}
                {canManage && <button className="mapp-btn mapp-btn-danger" onClick={() => onDelete(record.id)}>Delete</button>}
              </div>
            </MobileCard>
          ))
        ) : (
          <div className="mapp-empty">
            <FactoryIcon />
            <p>No production records yet. Start production from Orders module.</p>
          </div>
        )}
      </div>

      {isModalOpen && editingId && canManage && (
        <div className="mapp-modal-overlay">
          <div className="mapp-modal">
            <h3>Edit Production</h3>
            <form className="mapp-form" onSubmit={onSubmit}>
              {editingRecord && (
                <>
                  <p><strong>Client Code:</strong> {`${((editingRecord.order?.clientName || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "CL").padEnd(2, "X")}${Number.isFinite(Number(editingRecord.order?.id)) && Number(editingRecord.order?.id) > 0 ? String(Number(editingRecord.order?.id)).padStart(3, "0") : "000"}`}</p>
                  <p><strong>Sales Order No:</strong> {editingRecord.order?.salesOrderNumber || "-"}</p>
                  <p><strong>Product:</strong> {editingRecord.order?.product || editingRecord.order?.enquiry?.product || "-"}</p>
                  <p><strong>Grade / QTY:</strong> {editingRecord.order?.grade || "-"} / {editingRecord.order?.quantity || "-"}</p>
                  <p><strong>Unit of Measurement:</strong> {editingRecord.order?.unit || "-"}</p>
                  <p><strong>Expected Timeline:</strong> {formatDate(editingRecord.deliveryDate || editingRecord.order?.deliveryDate)}</p>
                  <p><strong>City:</strong> {editingRecord.order?.city || "-"}</p>
                  <p><strong>Country Code:</strong> {editingRecord.order?.countryCode || "-"}</p>
                  <p><strong>Status:</strong> {editingRecord.status || "-"}</p>
                  <p><strong>Production Completion Date:</strong> {formatDate(editingRecord.productionCompletionDate)}</p>
                  <p><strong>Date of Export:</strong> {formatDate(getOrderExportDate(editingRecord.order))}</p>
                </>
              )}
              <label>Status</label>
              <select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>
                {productionStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <label>Delivery Date</label>
              <input type="date" value={form.delivery_date} onChange={(event) => setForm((prev) => ({ ...prev, delivery_date: event.target.value }))} required />
              <label>Capacity</label>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                required
              />
              <label>Remarks</label>
              <textarea
                rows="2"
                value={form.remarks}
                onChange={(event) => setForm((prev) => ({ ...prev, remarks: event.target.value }))}
              />
              <div className="mapp-form-actions">
                <button
                  type="button"
                  className="mapp-btn mapp-btn-secondary"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
                    setEditingRecord(null);
                  }}
                >
                  Cancel
                </button>
                <button className="mapp-btn mapp-btn-primary" disabled={saving}>{saving ? "Saving..." : "Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedRecord && (
        <div className="mapp-modal-overlay">
          <div className="mapp-modal">
            <h3>Production Details</h3>
            <p className="mapp-modal-sub">{selectedRecord.order?.orderNo || "-"}</p>
            <div className="mapp-form" style={{ marginTop: "12px" }}>
              <p><strong>Product:</strong> {selectedRecord.order?.product || selectedRecord.order?.enquiry?.product || "-"}</p>
              <p><strong>Assigned Team/User:</strong> {selectedRecord.assignedPersonnel || "-"}</p>
              <p><strong>Status:</strong> {selectedRecord.status || "-"}</p>
              <p><strong>Delivery Date:</strong> {formatDate(selectedRecord.deliveryDate || selectedRecord.order?.deliveryDate)}</p>
              <p><strong>Production Completion Date:</strong> {formatDate(selectedRecord.productionCompletionDate)}</p>
              <p><strong>Quantity:</strong> {selectedRecord.order?.quantity || "-"}</p>
              <p><strong>Client:</strong> {selectedRecord.order?.clientName || "-"}</p>
            </div>
            <div className="mapp-form-actions">
              <button type="button" className="mapp-btn mapp-btn-secondary" onClick={() => setSelectedRecord(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionMobileModule;
