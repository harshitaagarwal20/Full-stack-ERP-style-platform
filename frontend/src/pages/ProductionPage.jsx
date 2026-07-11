import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axiosClient";
import VirtualizedTableBody from "../components/common/VirtualizedTableBody";
import { BoxesIcon, ClipboardIcon, EditIcon, EyeIcon, FactoryIcon, SearchIcon, TrashIcon } from "../components/erp/ErpIcons";
import { useAuth } from "../context/AuthContext";
import useMasterData from "../hooks/useMasterData";
import useKnownItemIds from "../hooks/useKnownItemIds";
import { useIsMobile } from "../hooks/useIsMobile";
import { logApiError } from "../utils/apiError";
import { exportRowsToExcel } from "../utils/exportExcel";
import { getDisplaySalesNumber } from "../utils/businessNumbers";
import SearchableSelect from "../components/common/SearchableSelect";
import { formatDuration } from "../utils/productionMfg";
import Toolbar from "../components/common/Toolbar";
import Alert from "../components/common/Alert";
import StatusBadge from "../components/common/StatusBadge";

const PRODUCTION_STATUS_CONFIG = {
  PENDING: { label: "Not Started", background: "#e2e8f0", color: "#475569" },
  IN_PROGRESS: { label: "In Progress", background: "#ffedd5", color: "#c2410c" },
  PARTIALLY_PRODUCED: { label: "Partially Produced", background: "#dbeafe", color: "#1d4ed8" },
  HOLD: { label: "Hold", background: "#dbeafe", color: "#1d4ed8" },
  COMPLETED: { label: "Completed", background: "#dbeafe", color: "#1d4ed8" }
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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

// Matches StatusBadge's own fallback exactly (raw status string, not a
// hardcoded guess) so the exported file can never show a different status
// than what's rendered on screen for the same record.
function getStatusLabel(status) {
  return PRODUCTION_STATUS_CONFIG[status]?.label || status || "-";
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

function getOrderRemainingQuantity(order) {
  if (!order) return 0;

  const dispatchedQuantity = (order.dispatches || []).reduce(
    (sum, item) => sum + Number(item.dispatchedQuantity || 0),
    0
  );

  return Math.max(Number(order.quantity || 0) - dispatchedQuantity, 0);
}

function normalizeCustomerName(value) {
  return String(value || "").trim().toLowerCase();
}

function getBatchAutoFill(batches, batchNo = "") {
  const list = Array.isArray(batches) ? batches : [];
  const selectedBatchNo = String(batchNo || "").trim();
  const selected = selectedBatchNo ? list.find((batch) => batch.batchNo === selectedBatchNo) : null;
  if (selected) {
    return {
      batch_no: selected.batchNo || "",
      vendor: selected.vendor || "",
      grade: selected.grade || ""
    };
  }

  if (list.length === 1) {
    return {
      batch_no: list[0].batchNo || "",
      vendor: list[0].vendor || "",
      grade: list[0].grade || ""
    };
  }

  const suppliers = [...new Set(list.map((batch) => String(batch.vendor || "").trim()).filter(Boolean))];
  const grades = [...new Set(list.map((batch) => String(batch.grade || "").trim()).filter(Boolean))];
  return {
    batch_no: "",
    vendor: suppliers.length === 1 ? suppliers[0] : "",
    grade: grades.length === 1 ? grades[0] : ""
  };
}

function ProductionPage() {
  const PAGE_SIZE = 10;
  const navigate = useNavigate();
  const { user } = useAuth();
  const masterData = useMasterData();
  const knownItemIds = useKnownItemIds();
  const knownItemIdOptions = useMemo(
    () => knownItemIds.map((id) => ({ value: id, label: id })),
    [knownItemIds]
  );
  const rawMaterialOptions = useMemo(() => {
    const catalog = Array.isArray(masterData.rawMaterialsCatalog) ? masterData.rawMaterialsCatalog : [];
    if (catalog.length > 0) return catalog;
    return knownItemIdOptions;
  }, [knownItemIdOptions, masterData.rawMaterialsCatalog]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProductionId, setEditingProductionId] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [mfgOrderRecord, setMfgOrderRecord] = useState(null);
  const [mfgForm, setMfgForm] = useState(null);
  const [pfrForm, setPfrForm] = useState(null);
  const [mfgStep, setMfgStep] = useState(null); // null | "mfg" | "pfr"
  const [opsRecord, setOpsRecord] = useState(null);
  const [opsLogs, setOpsLogs] = useState(null);
  const [opsMaterialNames, setOpsMaterialNames] = useState(["Material 1", "Material 2"]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const isMobile = useIsMobile();
  useEffect(() => { if (isMobile) { setDateFilter(""); } }, [isMobile]);
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [productionRecords, setProductionRecords] = useState([]);
  const [batchOptionsByItem, setBatchOptionsByItem] = useState({});
  const [form, setForm] = useState({
    delivery_date: "",
    capacity: "",
    remarks: "",
    status: "PENDING",
    state: ""
  });
  const tableWrapRef = useRef(null);
  const fetchDataRef = useRef(null);
  const customerMasterRows = useMemo(
    () => (Array.isArray(masterData.customerMaster) ? masterData.customerMaster : []),
    [masterData.customerMaster]
  );
  const supplierOptions = useMemo(() => {
    const supplierMaster = Array.isArray(masterData.supplierMaster) ? masterData.supplierMaster : [];
    return supplierMaster.map((s) => ({
      value: s.supplierName,
      label: s.supplierName,
      searchText: [s.supplierName, s.supplierCode].filter(Boolean).join(" ")
    }));
  }, [masterData.supplierMaster]);
  const supervisorOptions = useMemo(
    () => (Array.isArray(masterData.supervisors) ? masterData.supervisors : []),
    [masterData.supervisors]
  );
  const customerMasterMap = useMemo(() => {
    const map = new Map();
    customerMasterRows.forEach((row) => {
      const key = normalizeCustomerName(row.customerName);
      if (key) {
        map.set(key, row);
      }
    });
    return map;
  }, [customerMasterRows]);
  const getOrderLocation = (order) => {
    const matchedCustomer = customerMasterMap.get(normalizeCustomerName(order?.clientName));
    return {
      city: matchedCustomer?.city || order?.city || "",
      pincode: matchedCustomer?.pincode || order?.pincode || "",
      state: matchedCustomer?.state || order?.state || "",
      countryCode: matchedCustomer?.countryCode || order?.countryCode || ""
    };
  };
  const productionStatusOptions = useMemo(
    () => masterData.productionStatuses,
    [masterData.productionStatuses]
  );
  const productionEditStatusOptions = useMemo(
    () => productionStatusOptions.filter((option) => option.value !== "COMPLETED"),
    [productionStatusOptions]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      ...masterData.productionStatuses
    ],
    [masterData.productionStatuses]
  );
  const canManageProduction = ["admin", "production"].includes(user?.role);

  const ensureBatchOptions = async (itemName) => {
    const key = String(itemName || "").trim();
    if (!key) return [];
    if (batchOptionsByItem[key]) return batchOptionsByItem[key];
    try {
      const { data } = await api.get("/inventory/item-batches", { params: { itemId: key } });
      const batches = Array.isArray(data.batches) ? data.batches : [];
      setBatchOptionsByItem((prev) => ({ ...prev, [key]: batches }));
      return batches;
    } catch {
      setBatchOptionsByItem((prev) => ({ ...prev, [key]: [] }));
      return [];
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const productionRes = await api.get("/production", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          company: companyFilter || undefined,
          date: dateFilter || undefined,
          page: currentPage,
          limit: PAGE_SIZE
        }
      });
      const payload = productionRes.data;
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const pagination = payload?.pagination || null;
      setProductionRecords(items);
      setTotalPages(Math.max(1, Number(pagination?.totalPages || 1)));
      setTotalRecords(Number(pagination?.total || items.length));
      setFetchError(false);
    } catch (error) {
      logApiError(error, "Failed to load production data");
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  };

  fetchDataRef.current = fetchData;

  useEffect(() => {
    fetchData();
  }, [query, statusFilter, companyFilter, dateFilter, currentPage]);

  useEffect(() => {
    const id = setInterval(() => fetchDataRef.current(), 10_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!mfgForm) return;
    ["rm", "additives", "catalysts"].forEach((section) => {
      (mfgForm[section] || []).forEach((row) => {
        if (row?.name) ensureBatchOptions(row.name);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mfgForm?.rm?.map((row) => row.name).join("|"), mfgForm?.additives?.map((row) => row.name).join("|"), mfgForm?.catalysts?.map((row) => row.name).join("|")]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchDataRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const sortedRecords = useMemo(() => {
    const sorted = [...productionRecords];
    const { key, direction } = sortConfig;
    const sign = direction === "asc" ? 1 : -1;

    const getValue = (record) => {
      if (key === "orderNo") return String(record.order?.orderNo || "").toLowerCase();
      if (key === "createdAt") return new Date(record.createdAt || record.order?.createdAt || 0).getTime();
      if (key === "salesOrderNumber") return String(getDisplaySalesNumber(record.order) || "").toLowerCase();
      if (key === "product") return String(record.order?.product || record.order?.enquiry?.product || "").toLowerCase();
      if (key === "quantity") return Number(record.order?.quantity || 0);
      if (key === "deliveryDate") return new Date(record.deliveryDate || record.order?.deliveryDate || 0).getTime();
      if (key === "status") return String(record.status || "").toLowerCase();
      return "";
    };

    sorted.sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (va < vb) return -1 * sign;
      if (va > vb) return 1 * sign;
      if (key === "orderNo") {
        const ta = new Date(a.createdAt || a.order?.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || b.order?.createdAt || 0).getTime();
        if (ta < tb) return -1 * sign;
        if (ta > tb) return 1 * sign;
      }
      return 0;
    });
    return sorted;
  }, [productionRecords, sortConfig]);

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

  const submitProduction = async (event) => {
    event.preventDefault();
    if (!canManageProduction || !editingProductionId) {
      return;
    }
    setSaving(true);
    try {
      const payload = {
        delivery_date: form.delivery_date,
        remarks: form.remarks,
        status: form.status,
        state: form.state,
        capacity: form.capacity ? Number(form.capacity) : undefined
      };

      await api.put(`/production/${editingProductionId}/edit`, payload);
      setForm({
        delivery_date: "",
        capacity: "",
        remarks: "",
        status: "PENDING",
        state: ""
      });
      setEditingProductionId(null);
      setIsCreateModalOpen(false);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save production record");
    } finally {
      setSaving(false);
    }
  };

  const exportProduction = async () => {
    let exportSource = sortedRecords;
    try {
      const { data } = await api.get("/production", {
        params: {
          q: query || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          company: companyFilter || undefined,
          date: dateFilter || undefined,
          page: 1,
          limit: 0
        }
      });
      exportSource = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : sortedRecords;
    } catch {
      // Fall back to loaded page.
    }

    exportRowsToExcel(
      `production_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { key: "clientCode", header: "Client Code" },
        { key: "orderNo", header: "Order No" },
        { key: "salesOrderNo", header: "Sales ID" },
        { key: "product", header: "Product" },
        { key: "gradeQty", header: "Grade / QUANTITY" },
        { key: "remainingQty", header: "Remaining QUANTITY" },
        { key: "unit", header: "Unit of Measurement" },
        { key: "expectedDeliveryDate", header: "Expected Delivery Date" },
        { key: "city", header: "City" },
        { key: "pincode", header: "Pincode" },
        { key: "state", header: "State" },
        { key: "countryCode", header: "Country Code" },
        { key: "status", header: "Status" },
        { key: "productionStartedDate", header: "Production Started Date" },
        { key: "productionCompDate", header: "Production Completion Date" },
        { key: "duration", header: "Duration" },
        { key: "dispatchDate", header: "Dispatch Date" },
        { key: "productionState", header: "Production State" }
      ],
      exportSource.map((record) => ({
        ...(function () {
          const location = getOrderLocation(record.order);
          return {
            city: location.city || "-",
            pincode: location.pincode || "-",
            state: location.state || "-",
            countryCode: location.countryCode || "-"
          };
        })(),
        clientCode: getClientCode(record.order?.clientName, record.order?.id),
        salesOrderNo: getDisplaySalesNumber(record.order) || "-",
        product: record.order?.product || record.order?.enquiry?.product || "-",
        gradeQty: `${record.order?.grade || "-"} / ${record.order?.quantity || "-"}`,
        remainingQty: getOrderRemainingQuantity(record.order),
        unit: record.order?.unit || "-",
        expectedDeliveryDate: formatDate(record.deliveryDate || record.order?.deliveryDate),
        status: getStatusLabel(record.status),
        productionStartedDate: formatDateTime(record.productionStartedDate),
        productionCompDate: formatDateTime(record.productionCompletionDate),
        duration: formatDuration(record.productionStartedDate, record.productionCompletionDate),
        dispatchDate: formatDate(getOrderDispatchDate(record.order)),
        productionState: record.state || "-"
      }))
    );
  };

  const completeProduction = async (id) => {
    if (!canManageProduction) return;
    try {
      await api.put(`/production/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to complete production");
    }
  };

  const editProduction = (record) => {
    if (!canManageProduction) return;
    setEditingProductionId(record.id);
    setForm({
      delivery_date: record.deliveryDate ? new Date(record.deliveryDate).toISOString().slice(0, 10) : "",
      capacity: record.capacity ? String(record.capacity) : "",
      remarks: record.remarks || "",
      status: record.status || "PENDING",
      state: record.state || ""
    });
    setIsCreateModalOpen(true);
  };

  const removeProduction = async (id) => {
    if (!canManageProduction) return;
    if (!window.confirm("Delete this production record?")) return;
    try {
      await api.delete(`/production/${id}`);
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to delete production record");
    }
  };

  const emptyMaterialRow = () => ({ name: "", vendor: "", grade: "", batch_no: "", qty: "", remark: "", shift: "" });
  const emptyEquipRow    = () => ({ name: "", equipId: "", capacity: "" });
  const emptyParamRow    = () => ({ parameter: "", range: "", doneBy: "", reviewedBy: "", remark: "" });

  const defaultEquipment = () => [
    { name: "Stainless Steel Reactor", equipId: "", capacity: "" },
    { name: "Screw Conveyor No",       equipId: "", capacity: "" },
    { name: "Grinding Mill, No",       equipId: "", capacity: "" },
    { name: "Classifier No",           equipId: "", capacity: "" },
    { name: "Dust Collector No",       equipId: "", capacity: "" },
    { name: "Storage Silo",            equipId: "", capacity: "" }
  ];

  const defaultProcessParams = () => [
    { parameter: "Initial Temperature",    range: "70 to 120°C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Reaction Temperature",   range: "80 to 100°C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Chopper Temperature",    range: "85 to 100°C", doneBy: "", reviewedBy: "", remark: "" },
    { parameter: "Completion Temperature", range: "80 to 120°C", doneBy: "", reviewedBy: "", remark: "" }
  ];

  const parseMfgRawMaterials = (rawMaterials) => {
    try {
      const parsed = JSON.parse(rawMaterials || "{}");
      return {
        rm:            Array.isArray(parsed.rm)            ? parsed.rm            : [emptyMaterialRow()],
        additives:     Array.isArray(parsed.additives)     ? parsed.additives     : [emptyMaterialRow()],
        catalysts:     Array.isArray(parsed.catalysts)     ? parsed.catalysts     : [emptyMaterialRow()],
        pulveriserRpm: parsed.pulveriserRpm || "",
        equipment:     Array.isArray(parsed.equipment)     ? parsed.equipment     : defaultEquipment(),
        processParams: Array.isArray(parsed.processParams) ? parsed.processParams : defaultProcessParams()
      };
    } catch {
      return {
        rm: [emptyMaterialRow()], additives: [emptyMaterialRow()], catalysts: [emptyMaterialRow()],
        pulveriserRpm: "", equipment: defaultEquipment(), processParams: defaultProcessParams()
      };
    }
  };

  const mfgDraftKey  = (id) => `mfg_draft_${id}`;
  const saveMfgDraft = (id, mfg, pfr) => {
    try { localStorage.setItem(mfgDraftKey(id), JSON.stringify({ mfg, pfr })); } catch { /* ignore */ }
  };
  const loadMfgDraft = (id) => {
    try { const raw = localStorage.getItem(mfgDraftKey(id)); return raw ? JSON.parse(raw) : null; } catch { return null; }
  };
  const clearMfgDraft = (id) => {
    try { localStorage.removeItem(mfgDraftKey(id)); } catch { /* ignore */ }
  };

  const openMfgOrder = (record) => {
    const mats = parseMfgRawMaterials(record.rawMaterials);
    const serverMfg = {
      batch_no:       record.batchNo      || "",
      particle_size:  record.particleSize || "Fine",
      acm_rpm:        record.acmRpm       ? String(record.acmRpm)    : "",
      classifier_rpm: mats.pulveriserRpm  || (record.classifierRpm ? String(record.classifierRpm) : ""),
      blower_rpm:     record.blowerRpm    ? String(record.blowerRpm) : "",
      rm:             mats.rm,
      additives:      mats.additives,
      catalysts:      mats.catalysts,
      remarks:        record.remarks || ""
    };
    const serverPfr = {
      equipment:     mats.equipment,
      processParams: mats.processParams
    };
    const draft = loadMfgDraft(record.id);
    setMfgOrderRecord(record);
    setPfrForm(draft?.pfr || serverPfr);
    setMfgStep("mfg");

    if (draft?.mfg) {
      setMfgForm(draft.mfg);
      return;
    }

    setMfgForm(serverMfg);
  };

  const closeAll = () => {
    setMfgOrderRecord(null);
    setMfgForm(null);
    setPfrForm(null);
    setMfgStep(null);
  };

  // Full raw materials blob as-is (unlike parseMfgRawMaterials, this keeps
  // every key — including batchLogs — so saves from this wizard never wipe
  // out sections filled in elsewhere, like the Operation Log).
  const getExistingMfgBlob = (rawMaterials) => {
    try {
      return JSON.parse(rawMaterials || "{}");
    } catch {
      return {};
    }
  };

  // Opens Process Feeding Record on its own, independent of the batch-setup
  // step — since these are filled in at different times on the floor.
  const openPfr = (record) => {
    const mats = parseMfgRawMaterials(record.rawMaterials);
    setMfgOrderRecord(record);
    setMfgForm({
      batch_no:       record.batchNo      || "",
      particle_size:  record.particleSize || "Fine",
      acm_rpm:        record.acmRpm       ? String(record.acmRpm)    : "",
      classifier_rpm: mats.pulveriserRpm  || (record.classifierRpm ? String(record.classifierRpm) : ""),
      blower_rpm:     record.blowerRpm    ? String(record.blowerRpm) : "",
      rm:             mats.rm,
      additives:      mats.additives,
      catalysts:      mats.catalysts,
      remarks:        record.remarks || ""
    });
    setPfrForm({ equipment: mats.equipment, processParams: mats.processParams });
    setMfgStep("pfr");
  };

  const setMfgField = (key, value) => setMfgForm((prev) => ({ ...prev, [key]: value }));

  const setMaterialRow = (section, index, key, value) =>
    setMfgForm((prev) => ({
      ...prev,
      [section]: prev[section].map((r, i) => i === index ? { ...r, [key]: value } : r)
    }));

  const patchMaterialRow = (section, index, patch) =>
    setMfgForm((prev) => ({
      ...prev,
      [section]: prev[section].map((r, i) => i === index ? { ...r, ...patch } : r)
    }));

  const handleMaterialItemChange = async (section, index, value) => {
    patchMaterialRow(section, index, { name: value, batch_no: "", vendor: "", grade: "" });
    const batches = await ensureBatchOptions(value);
    patchMaterialRow(section, index, getBatchAutoFill(batches));
  };

  const handleMaterialBatchChange = (section, index, itemName, value) => {
    const autoFill = getBatchAutoFill(batchOptionsByItem[itemName] || [], value);
    patchMaterialRow(section, index, { batch_no: value, vendor: autoFill.vendor, grade: autoFill.grade });
  };

  const addMaterialRow = (section) =>
    setMfgForm((prev) => ({ ...prev, [section]: [...prev[section], emptyMaterialRow()] }));

  const removeMaterialRow = (section, index) =>
    setMfgForm((prev) => {
      if (prev[section].length <= 1) return prev;
      return { ...prev, [section]: prev[section].filter((_, i) => i !== index) };
    });

  // PFR form row helpers
  const setEquipRow = (index, key, value) =>
    setPfrForm((prev) => ({
      ...prev,
      equipment: prev.equipment.map((r, i) => i === index ? { ...r, [key]: value } : r)
    }));

  const addEquipRow = () =>
    setPfrForm((prev) => ({ ...prev, equipment: [...prev.equipment, emptyEquipRow()] }));

  const removeEquipRow = (index) =>
    setPfrForm((prev) => {
      if (prev.equipment.length <= 1) return prev;
      return { ...prev, equipment: prev.equipment.filter((_, i) => i !== index) };
    });

  const setParamRow = (index, key, value) =>
    setPfrForm((prev) => ({
      ...prev,
      processParams: prev.processParams.map((r, i) => i === index ? { ...r, [key]: value } : r)
    }));

  const addParamRow = () =>
    setPfrForm((prev) => ({ ...prev, processParams: [...prev.processParams, emptyParamRow()] }));

  const removeParamRow = (index) =>
    setPfrForm((prev) => {
      if (prev.processParams.length <= 1) return prev;
      return { ...prev, processParams: prev.processParams.filter((_, i) => i !== index) };
    });

  // Manufacturing Operation Log
  const emptyOpsRow = () => ({
    lotNo: "", date: new Date().toLocaleDateString("en-GB"),
    material1Qty: "", material2Qty: "",
    initialTemp: "", reactionTemp: "", chopperTemp: "", completionTemp: "",
    doneBy: ""
  });

  // Older saved logs stored quantities under the hardcoded "stearicAcid"/"caOH2"
  // keys; migrate them to the generic material1Qty/material2Qty keys on load.
  const migrateOpsRow = (row) => ({
    ...row,
    material1Qty: row.material1Qty ?? row.stearicAcid ?? "",
    material2Qty: row.material2Qty ?? row.caOH2 ?? ""
  });

  const openOps = (record) => {
    const mats = parseMfgRawMaterials(record.rawMaterials);
    const rmNames = mats.rm.map((r) => r.name).filter(Boolean);
    setOpsMaterialNames([rmNames[0] || "Material 1", rmNames[1] || "Material 2"]);

    try {
      const parsed = JSON.parse(record.rawMaterials || "{}");
      const logs = Array.isArray(parsed.batchLogs) ? parsed.batchLogs : [emptyOpsRow()];
      setOpsLogs(logs.map(migrateOpsRow));
    } catch {
      setOpsLogs([emptyOpsRow()]);
    }
    setOpsRecord(record);
  };

  const closeOps = () => { setOpsRecord(null); setOpsLogs(null); };

  const setOpsRow = (index, key, value) =>
    setOpsLogs((prev) => prev.map((r, i) => i === index ? { ...r, [key]: value } : r));

  const addOpsRow = () =>
    setOpsLogs((prev) => [...prev, emptyOpsRow()]);

  const removeOpsRow = (index) =>
    setOpsLogs((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });

  const submitOps = async (e) => {
    e.preventDefault();
    if (!opsRecord || saving) return;
    setSaving(true);
    try {
      const existing = JSON.parse(opsRecord.rawMaterials || "{}");
      const rawMaterialsJson = JSON.stringify({ ...existing, batchLogs: opsLogs });
      await api.put(`/production/${opsRecord.id}/edit`, { raw_materials: rawMaterialsJson });
      closeOps();
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save operation log");
    } finally {
      setSaving(false);
    }
  };

  // Auto-save mfg + pfr form to localStorage whenever they change
  useEffect(() => {
    if (mfgOrderRecord && mfgForm && pfrForm) {
      saveMfgDraft(mfgOrderRecord.id, mfgForm, pfrForm);
    }
  }, [mfgForm, pfrForm, mfgOrderRecord]);

  // Step 1: Mfg form (batch setup + materials) — saves on its own, since
  // Process Feeding Record is typically filled in later, not in one sitting.
  const submitMfg = async (e, advanceToPfr) => {
    e.preventDefault();
    if (!mfgOrderRecord || saving) return;
    setSaving(true);
    try {
      const rawMaterialsJson = JSON.stringify({
        ...getExistingMfgBlob(mfgOrderRecord.rawMaterials),
        rm:            mfgForm.rm,
        additives:     mfgForm.additives,
        catalysts:     mfgForm.catalysts,
        pulveriserRpm: mfgForm.classifier_rpm
      });
      const newStatus = mfgOrderRecord.status === "PENDING" ? "IN_PROGRESS" : mfgOrderRecord.status;
      await api.put(`/production/${mfgOrderRecord.id}/edit`, {
        status:        newStatus,
        batch_no:      mfgForm.batch_no      || undefined,
        particle_size: mfgForm.particle_size || undefined,
        acm_rpm:       mfgForm.acm_rpm       ? Number(mfgForm.acm_rpm)    : undefined,
        blower_rpm:    mfgForm.blower_rpm     ? Number(mfgForm.blower_rpm) : undefined,
        raw_materials: rawMaterialsJson,
        remarks:       mfgForm.remarks       || undefined
      });
      clearMfgDraft(mfgOrderRecord.id);

      if (advanceToPfr) {
        const { data } = await api.get(`/production/${mfgOrderRecord.id}`);
        const mats = parseMfgRawMaterials(data.rawMaterials);
        setMfgOrderRecord(data);
        setPfrForm({ equipment: mats.equipment, processParams: mats.processParams });
        setMfgStep("pfr");
      } else {
        closeAll();
      }
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save batch setup");
    } finally {
      setSaving(false);
    }
  };

  // Step 2 (or standalone, via openPfr): Process Feeding Record → equipment + process params.
  const submitPfr = async (e) => {
    e.preventDefault();
    if (!mfgOrderRecord || saving) return;
    setSaving(true);
    try {
      const rawMaterialsJson = JSON.stringify({
        ...getExistingMfgBlob(mfgOrderRecord.rawMaterials),
        rm:            mfgForm.rm,
        additives:     mfgForm.additives,
        catalysts:     mfgForm.catalysts,
        pulveriserRpm: mfgForm.classifier_rpm,
        equipment:     pfrForm.equipment,
        processParams: pfrForm.processParams
      });
      const newStatus = mfgOrderRecord.status === "PENDING" ? "IN_PROGRESS" : mfgOrderRecord.status;
      await api.put(`/production/${mfgOrderRecord.id}/edit`, {
        status:        newStatus,
        batch_no:      mfgForm.batch_no      || undefined,
        particle_size: mfgForm.particle_size || undefined,
        acm_rpm:       mfgForm.acm_rpm       ? Number(mfgForm.acm_rpm)    : undefined,
        blower_rpm:    mfgForm.blower_rpm     ? Number(mfgForm.blower_rpm) : undefined,
        raw_materials: rawMaterialsJson,
        remarks:       mfgForm.remarks       || undefined
      });
      clearMfgDraft(mfgOrderRecord.id);
      closeAll();
      await fetchData();
    } catch (error) {
      logApiError(error, "Failed to save process feeding record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="order-page production-page">
      <Toolbar
        title="Production"
        search={
          <div className="ui-toolbar-search">
            <SearchIcon />
            <input
              placeholder="Search order, product, company, or assigned team"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchSubmit();
              }}
            />
          </div>
        }
        actions={<button className="order-btn-secondary" onClick={exportProduction}>Export to Excel</button>}
        filters={
          <>
            <SearchableSelect
              options={statusFilterOptions.map((option) => ({ value: option.value, label: option.label ?? option.value }))}
              value={statusFilter}
              onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }}
              placeholder="All Status"
            />
            <input
              className="production-filter-company"
              type="text"
              placeholder="Filter by company"
              value={companyFilter}
              onChange={(event) => { setCompanyFilter(event.target.value); setCurrentPage(1); }}
            />
            {!isMobile && (
              <input
                className="production-filter-date"
                type="date"
                value={dateFilter}
                onChange={(event) => { setDateFilter(event.target.value); setCurrentPage(1); }}
              />
            )}
            <button className="order-btn-primary ghost" onClick={onSearchSubmit}>Search</button>
          </>
        }
      />

      <section className="order-card" style={{ padding: "12px 20px" }}>
        {fetchError && (
          <Alert variant="error">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <span>Failed to load production records. Please refresh.</span>
              <button className="order-btn-secondary" onClick={() => fetchDataRef.current()}>Retry</button>
            </div>
          </Alert>
        )}

        {loading ? (
          <div className="order-skeleton-list" style={{ padding: 20 }}>
            {[1, 2, 3].map((item) => <div key={item} className="production-skeleton-row" />)}
          </div>
        ) : sortedRecords.length ? (
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
                    <th>Client Code</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("orderNo")}>Order No</button></th>
                    <th><button className="order-sort-btn" onClick={() => onSort("salesOrderNumber")}>Sales ID</button></th>
                    <th><button className="order-sort-btn" onClick={() => onSort("product")}>Product</button></th>
                    <th>Grade / QUANTITY</th>
                    <th>Remaining QUANTITY</th>
                    <th>Unit of Measurement</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("deliveryDate")}>Expected Timeline</button></th>
                    <th>City</th>
                    <th>Pincode</th>
                    <th>State</th>
                    <th>Country Code</th>
                    <th><button className="order-sort-btn" onClick={() => onSort("status")}>Status</button></th>
                    <th>Production Started Date</th>
                    <th>Production Completion Date</th>
                    <th>Duration</th>
                    <th>Dispatch Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <VirtualizedTableBody
                  rows={sortedRecords}
                  colSpan={19}
                  rowHeight={52}
                  overscan={8}
                  scrollContainerRef={tableWrapRef}
                  getRowKey={(record) => record.id}
                  renderRow={(record, index) => {
                    const location = getOrderLocation(record.order);
                    return (
                      <tr key={record.id}>
                        <td>{(currentPage - 1) * PAGE_SIZE + index + 1}</td>
                        <td>{getClientCode(record.order?.clientName, record.order?.id)}</td>
                        <td>{record.order?.orderNo || "-"}</td>
                        <td>{getDisplaySalesNumber(record.order) || "-"}</td>
                        <td>{record.order?.product || record.order?.enquiry?.product || "-"}</td>
                        <td>{record.order?.grade || "-"} / {record.order?.quantity || "-"}</td>
                        <td>{getOrderRemainingQuantity(record.order)}</td>
                        <td>{record.order?.unit || "-"}</td>
                        <td>{formatDate(record.deliveryDate || record.order?.deliveryDate)}</td>
                        <td>{location.city || "-"}</td>
                        <td>{location.pincode || "-"}</td>
                        <td>{location.state || "-"}</td>
                        <td>{location.countryCode || "-"}</td>
                        <td>
                          <StatusBadge status={record.status} config={PRODUCTION_STATUS_CONFIG} />
                        </td>
                        <td>{formatDateTime(record.productionStartedDate)}</td>
                        <td>{formatDateTime(record.productionCompletionDate)}</td>
                        <td>{formatDuration(record.productionStartedDate, record.productionCompletionDate)}</td>
                        <td>{formatDate(getOrderDispatchDate(record.order))}</td>
                        <td>
                          <div className="order-row-actions">
                            <button className="icon-btn" onClick={() => navigate(`/production/${record.id}`)} aria-label="View production record" title="View production record">
                              <EyeIcon />
                            </button>
                            {canManageProduction && (
                              <button className="icon-btn" onClick={() => editProduction(record)} aria-label="Edit production record" title="Edit production record">
                                <EditIcon />
                              </button>
                            )}
                            {canManageProduction && record.status === "PENDING" && (
                              <button className="order-btn-primary" onClick={() => openMfgOrder(record)}>
                                Start Production
                              </button>
                            )}
                            {canManageProduction && record.status === "IN_PROGRESS" && (
                              <button className="icon-btn" onClick={() => openPfr(record)} aria-label="Process Feeding Record" title="Process Feeding Record">
                                <BoxesIcon />
                              </button>
                            )}
                            {canManageProduction && record.status === "IN_PROGRESS" && (
                              <button className="icon-btn" onClick={() => openOps(record)} aria-label="Operations" title="Operations">
                                <ClipboardIcon />
                              </button>
                            )}
                            {canManageProduction && record.status === "IN_PROGRESS" && (
                              <button className="order-btn-primary" onClick={() => completeProduction(record.id)}>Complete</button>
                            )}
                            {canManageProduction && record.status === "COMPLETED" && (
                              <button className="order-btn-secondary" disabled>Completed</button>
                            )}
                            {canManageProduction && <button className="production-link-btn delete" onClick={() => removeProduction(record.id)}><TrashIcon /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  }}
                />
              </table>
              <div className="order-pagination" style={{ borderTop: "1px solid #f1f5f9" }}>
                <div className="order-pagination-info">Page {currentPage} of {totalPages}</div>
                <div className="order-page-controls">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>Prev</button>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="order-empty-state">
            <div className="order-empty-icon"><FactoryIcon /></div>
            <p>No production records yet. Start production from Orders module.</p>
          </div>
        )}
      </section>

      {isCreateModalOpen && editingProductionId && canManageProduction && (
        <div className="production-modal-overlay">
          <div className="production-modal-card large" style={{ maxWidth: 880 }}>
            <div className="production-modal-head">
              <div>
                <h3>Edit Production</h3>
                <p>Edit production entry details and status.</p>
              </div>
              <button
                className="production-modal-close"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingProductionId(null);
                }}
                disabled={saving}
              >
                Close
              </button>
            </div>

            <form className="production-form-grid" onSubmit={submitProduction}>
              <div>
                <label>Status</label>
                <SearchableSelect
                  options={productionEditStatusOptions.map((option) => ({ value: option.value, label: option.label ?? option.value }))}
                  value={form.status}
                  onChange={(value) => setForm((p) => ({ ...p, status: value }))}
                  placeholder="Select status"
                />
              </div>
              <div>
                <label>Expected Delivery Date</label>
                <input type="date" value={form.delivery_date} onChange={(e) => setForm((p) => ({ ...p, delivery_date: e.target.value }))} required />
              </div>
              <div>
                <label>Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} required />
              </div>
              <div className="full-row">
                <label>Remarks</label>
                <textarea rows="2" value={form.remarks} onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))} />
              </div>
              <div className="full-row production-form-actions">
                <button
                  type="button"
                  className="production-btn-secondary"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingProductionId(null);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button className="production-btn-primary" disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 1 – Manufacturing Order Modal */}
      {mfgOrderRecord && mfgForm && mfgStep === "mfg" && (
        <div className="mfg-overlay">
          <div className="mfg-modal">
            <div className="mfg-header">
              <div className="mfg-header-left">
                <span className="mfg-badge">Step 1 of 2 &nbsp;·&nbsp; Manufacturing Order</span>
                <h3 className="mfg-title">{mfgOrderRecord.order?.product || "Product"}</h3>
                <p className="mfg-subtitle">{mfgOrderRecord.order?.clientName} &mdash; {mfgOrderRecord.order?.orderNo}</p>
              </div>
              <button className="mfg-close-btn" onClick={closeAll} disabled={saving} aria-label="Close">&#10005;</button>
            </div>

            <div className="mfg-summary">
              {[
                { label: "Product",      value: mfgOrderRecord.order?.product },
                { label: "Grade",        value: mfgOrderRecord.order?.grade },
                { label: "Quantity",     value: `${mfgOrderRecord.order?.quantity} ${mfgOrderRecord.order?.unit}` },
                { label: "Packing Size", value: mfgOrderRecord.order?.packingSize },
                { label: "Packing Type", value: mfgOrderRecord.order?.packingType },
                { label: "Party",        value: mfgOrderRecord.order?.clientName }
              ].map(({ label, value }) => (
                <div key={label} className="mfg-summary-item">
                  <span className="mfg-summary-label">{label}</span>
                  <span className="mfg-summary-value">{value || "-"}</span>
                </div>
              ))}
            </div>

            <form onSubmit={(e) => submitMfg(e, false)} className="mfg-form">
              {/* Section 1 – Batch & Machine Settings */}
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">1</span>
                  <h4 className="mfg-section-title">Batch &amp; Machine Settings</h4>
                </div>
                <div className="mfg-settings-grid">
                  <div className="mfg-field">
                    <label className="mfg-label">Batch No. <span className="mfg-required">*</span></label>
                    <input className="mfg-input" placeholder="e.g. K/CS/143" value={mfgForm.batch_no} onChange={(e) => setMfgField("batch_no", e.target.value)} required />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Particle Size</label>
                    <input className="mfg-input" placeholder="e.g. Fine" value={mfgForm.particle_size} onChange={(e) => setMfgField("particle_size", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">ACM-RPM</label>
                    <input className="mfg-input" type="number" min="1" placeholder="e.g. 1200" value={mfgForm.acm_rpm} onChange={(e) => setMfgField("acm_rpm", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Pulveriser-RPM</label>
                    <input className="mfg-input" placeholder="e.g. Full / 1500" value={mfgForm.classifier_rpm} onChange={(e) => setMfgField("classifier_rpm", e.target.value)} />
                  </div>
                  <div className="mfg-field">
                    <label className="mfg-label">Blower-RPM</label>
                    <input className="mfg-input" type="number" min="1" placeholder="e.g. 1050" value={mfgForm.blower_rpm} onChange={(e) => setMfgField("blower_rpm", e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Sections 2-4 – Material Tables */}
              {[
                { key: "rm",        num: "2", label: "Approved Raw Materials", colLabel: "RM Name" },
                { key: "additives", num: "3", label: "Additives",              colLabel: "Additive" },
                { key: "catalysts", num: "4", label: "Catalyst",               colLabel: "Catalyst" }
              ].map(({ key, num, label, colLabel }) => (
                <div key={key} className="mfg-section">
                  <div className="mfg-section-header">
                    <span className="mfg-section-num">{num}</span>
                    <h4 className="mfg-section-title">{label}</h4>
                    <button type="button" className="mfg-add-btn" onClick={() => addMaterialRow(key)}>+ Add Row</button>
                  </div>
                  <div className="mfg-table-wrap">
                    <table className="mfg-table">
                      <thead>
                        <tr>
                          <th>{colLabel}</th><th>Supplier Name</th><th>Grade</th><th>Batch No.</th><th>Qty (kg)</th><th>Shift</th><th>Remark</th>
                          <th className="mfg-th-del" />
                        </tr>
                      </thead>
                      <tbody>
                        {mfgForm[key].map((row, i) => (
                          <tr key={i}>
                            <td>
                              <SearchableSelect
                                options={key === "rm" ? rawMaterialOptions : knownItemIdOptions}
                                value={row.name}
                                onChange={(value) => { handleMaterialItemChange(key, i, value); }}
                                placeholder={colLabel}
                                allowCustom
                              />
                            </td>
                            <td>
                              <SearchableSelect
                                options={supplierOptions}
                                value={row.vendor}
                                onChange={(value) => setMaterialRow(key, i, "vendor", value)}
                                placeholder="Supplier"
                                allowCustom
                              />
                            </td>
                            <td><input className="mfg-cell-input" value={row.grade}    placeholder="Grade"    onChange={(e) => setMaterialRow(key, i, "grade",    e.target.value)} /></td>
                            <td>
                              <SearchableSelect
                                options={(batchOptionsByItem[row.name] || []).map((batch) => ({
                                  value: batch.batchNo,
                                  label: `${batch.batchNo}${batch.vendor ? ` — ${batch.vendor}` : ""} (${batch.availableQty} avail)`,
                                  searchText: [batch.batchNo, batch.vendor, batch.grade].filter(Boolean).join(" ")
                                }))}
                                value={row.batch_no}
                                onChange={(value) => { handleMaterialBatchChange(key, i, row.name, value); }}
                                placeholder="Batch"
                                allowCustom
                              />
                            </td>
                            <td><input className="mfg-cell-input mfg-cell-qty" type="number" min="0" step="0.1" value={row.qty} placeholder="0" onChange={(e) => setMaterialRow(key, i, "qty", e.target.value)} /></td>
                            <td>
                              <SearchableSelect
                                options={[{ value: "A", label: "A-Shift" }, { value: "B", label: "B-Shift" }, { value: "C", label: "C-Shift" }]}
                                value={row.shift}
                                onChange={(value) => setMaterialRow(key, i, "shift", value)}
                                placeholder="Shift"
                              />
                            </td>
                            <td><input className="mfg-cell-input" value={row.remark}   placeholder="Remark"   onChange={(e) => setMaterialRow(key, i, "remark",   e.target.value)} /></td>
                            <td className="mfg-td-del">
                              {mfgForm[key].length > 1 && (
                                <button type="button" className="mfg-del-btn" onClick={() => removeMaterialRow(key, i)} aria-label="Remove">&#10005;</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Section 5 – Remarks */}
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num">5</span>
                  <h4 className="mfg-section-title">Remarks / Order By</h4>
                </div>
                <textarea className="mfg-input mfg-textarea" rows={3} value={mfgForm.remarks} onChange={(e) => setMfgField("remarks", e.target.value)} placeholder="Additional instructions..." />
              </div>

              <div className="mfg-footer">
                <button type="button" className="mfg-btn-cancel" onClick={closeAll} disabled={saving}>Cancel</button>
                <button type="button" className="mfg-btn-cancel" onClick={(e) => submitMfg(e, true)} disabled={saving}>
                  Save &amp; Continue to Process Feeding &rarr;
                </button>
                <button type="submit" className="mfg-btn-submit" disabled={saving}>
                  {saving ? "Saving…" : "Save & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Step 2 – Process Feeding Record Modal */}
      {mfgOrderRecord && pfrForm && mfgStep === "pfr" && (
        <div className="mfg-overlay">
          <div className="mfg-modal">
            <div className="mfg-header pfr-header">
              <div className="mfg-header-left">
                <span className="mfg-badge">Process Feeding Record</span>
                <h3 className="mfg-title">{mfgOrderRecord.order?.product || "Product"}</h3>
                <p className="mfg-subtitle">{mfgOrderRecord.order?.clientName} &mdash; Batch: {mfgForm.batch_no || "—"}</p>
              </div>
              <button className="mfg-close-btn" onClick={closeAll} disabled={saving} aria-label="Close">&#10005;</button>
            </div>

            <div className="mfg-summary">
              {[
                { label: "Product",      value: mfgOrderRecord.order?.product },
                { label: "Product Code", value: mfgOrderRecord.order?.grade },
                { label: "Order No.",    value: mfgOrderRecord.order?.orderNo },
                { label: "Batch No.",    value: mfgForm.batch_no },
                { label: "Grade",        value: mfgOrderRecord.order?.grade },
                { label: "Department",   value: "Production" }
              ].map(({ label, value }) => (
                <div key={label} className="mfg-summary-item">
                  <span className="mfg-summary-label">{label}</span>
                  <span className="mfg-summary-value">{value || "-"}</span>
                </div>
              ))}
            </div>

            <form onSubmit={submitPfr} className="mfg-form">
              {/* Equipment Table */}
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num pfr-num">A</span>
                  <h4 className="mfg-section-title">Equipment Used in Production Line</h4>
                  <button type="button" className="mfg-add-btn" onClick={addEquipRow}>+ Add Row</button>
                </div>
                <div className="mfg-table-wrap">
                  <table className="mfg-table">
                    <thead>
                      <tr>
                        <th>Equipment Name</th>
                        <th>Equipment ID No.</th>
                        <th>Capacity</th>
                        <th className="mfg-th-del" />
                      </tr>
                    </thead>
                    <tbody>
                      {pfrForm.equipment.map((row, i) => (
                        <tr key={i}>
                          <td><input className="mfg-cell-input" value={row.name}     placeholder="Equipment name" onChange={(e) => setEquipRow(i, "name",     e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.equipId}  placeholder="NS/SSR/01"     onChange={(e) => setEquipRow(i, "equipId",  e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.capacity} placeholder="e.g. 2kl"     onChange={(e) => setEquipRow(i, "capacity", e.target.value)} /></td>
                          <td className="mfg-td-del">
                            {pfrForm.equipment.length > 1 && (
                              <button type="button" className="mfg-del-btn" onClick={() => removeEquipRow(i)} aria-label="Remove">&#10005;</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Critical Process Parameters */}
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <span className="mfg-section-num pfr-num">B</span>
                  <h4 className="mfg-section-title">Critical Process Parameters</h4>
                  <button type="button" className="mfg-add-btn" onClick={addParamRow}>+ Add Row</button>
                </div>
                <div className="mfg-table-wrap">
                  <table className="mfg-table">
                    <thead>
                      <tr>
                        <th>Parameter</th>
                        <th>Range</th>
                        <th>Done By</th>
                        <th>Reviewed By</th>
                        <th>Remark</th>
                        <th className="mfg-th-del" />
                      </tr>
                    </thead>
                    <tbody>
                      {pfrForm.processParams.map((row, i) => (
                        <tr key={i}>
                          <td><input className="mfg-cell-input" value={row.parameter}  placeholder="Parameter"      onChange={(e) => setParamRow(i, "parameter",  e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.range}      placeholder="e.g. 70-120°C" onChange={(e) => setParamRow(i, "range",      e.target.value)} /></td>
                          <td>
                            <SearchableSelect
                              options={supervisorOptions}
                              value={row.doneBy}
                              onChange={(value) => setParamRow(i, "doneBy", value)}
                              placeholder="Name"
                              allowCustom
                            />
                          </td>
                          <td>
                            <SearchableSelect
                              options={supervisorOptions}
                              value={row.reviewedBy}
                              onChange={(value) => setParamRow(i, "reviewedBy", value)}
                              placeholder="Name"
                              allowCustom
                            />
                          </td>
                          <td><input className="mfg-cell-input" value={row.remark}     placeholder="Remark"         onChange={(e) => setParamRow(i, "remark",     e.target.value)} /></td>
                          <td className="mfg-td-del">
                            {pfrForm.processParams.length > 1 && (
                              <button type="button" className="mfg-del-btn" onClick={() => removeParamRow(i)} aria-label="Remove">&#10005;</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mfg-footer">
                <button type="button" className="mfg-btn-cancel" onClick={() => setMfgStep("mfg")} disabled={saving}>
                  &larr; Edit Batch Setup
                </button>
                <button type="submit" className="mfg-btn-submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Process Feeding Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Manufacturing Operation Log Modal */}
      {opsRecord && opsLogs && (
        <div className="mfg-overlay">
          <div className="mfg-modal ops-modal">
            <div className="mfg-header ops-header">
              <div className="mfg-header-left">
                <span className="mfg-badge">Manufacturing Operation Log</span>
                <h3 className="mfg-title">{opsRecord.order?.product || "Product"}</h3>
                <p className="mfg-subtitle">
                  {opsRecord.order?.clientName} &mdash; Batch: {opsRecord.batchNo || "—"} &mdash; {opsLogs.length} entries
                </p>
              </div>
              <button className="mfg-close-btn" onClick={closeOps} disabled={saving} aria-label="Close">&#10005;</button>
            </div>

            <form onSubmit={submitOps} className="mfg-form">
              <div className="mfg-section">
                <div className="mfg-section-header">
                  <h4 className="mfg-section-title" style={{ marginLeft: 0 }}>Lot-wise Batch Record</h4>
                  <button type="button" className="mfg-add-btn" onClick={addOpsRow}>+ Add Row</button>
                </div>
                <div className="mfg-table-wrap ops-table-wrap">
                  <table className="mfg-table ops-table">
                    <thead>
                      <tr>
                        <th className="ops-col-sm">Lot No.</th>
                        <th className="ops-col-md">Date</th>
                        <th className="ops-col-md">{opsMaterialNames[0]} (kg)</th>
                        <th className="ops-col-md">{opsMaterialNames[1]} (kg)</th>
                        <th className="ops-col-temp" colSpan={4}>
                          <span className="ops-temp-group-label">Temp. &amp; Time</span>
                        </th>
                        <th className="ops-col-md">Done By</th>
                        <th className="mfg-th-del" />
                      </tr>
                      <tr className="ops-subhead">
                        <th /><th /><th /><th />
                        <th>Initial Temp.</th>
                        <th>Reaction Temp.</th>
                        <th>Chopper Temp.</th>
                        <th>Completion Temp.</th>
                        <th /><th />
                      </tr>
                    </thead>
                    <tbody>
                      {opsLogs.map((row, i) => (
                        <tr key={i}>
                          <td><input className="mfg-cell-input ops-input-sm" value={row.lotNo}          placeholder={String(i + 1)}  onChange={(e) => setOpsRow(i, "lotNo",          e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.date}            placeholder="DD/MM/YY"       onChange={(e) => setOpsRow(i, "date",            e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.material1Qty}  placeholder="800"             onChange={(e) => setOpsRow(i, "material1Qty",   e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.material2Qty}  placeholder="114"             onChange={(e) => setOpsRow(i, "material2Qty",   e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.initialTemp}    placeholder="90°C / 12:00"    onChange={(e) => setOpsRow(i, "initialTemp",    e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.reactionTemp}   placeholder="93°C / 13:30"    onChange={(e) => setOpsRow(i, "reactionTemp",   e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.chopperTemp}    placeholder="91°C"            onChange={(e) => setOpsRow(i, "chopperTemp",    e.target.value)} /></td>
                          <td><input className="mfg-cell-input" value={row.completionTemp} placeholder="99°C"            onChange={(e) => setOpsRow(i, "completionTemp", e.target.value)} /></td>
                          <td>
                            <SearchableSelect
                              options={supervisorOptions}
                              value={row.doneBy}
                              onChange={(value) => setOpsRow(i, "doneBy", value)}
                              placeholder="Name"
                              allowCustom
                            />
                          </td>
                          <td className="mfg-td-del">
                            {opsLogs.length > 1 && (
                              <button type="button" className="mfg-del-btn" onClick={() => removeOpsRow(i)} aria-label="Remove">&#10005;</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mfg-footer">
                <button type="button" className="mfg-btn-cancel" onClick={closeOps} disabled={saving}>Cancel</button>
                <button type="submit" className="mfg-btn-submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductionPage;
