import { useEffect, useState } from "react";
import api from "../api/axiosClient";

const DEFAULT_MASTER_DATA = {
  roles: [
    { value: "admin", label: "Admin" },
    { value: "sales", label: "Sales" },
    { value: "production", label: "Production" },
    { value: "dispatch", label: "Dispatch" }
  ],
  enquiryStatuses: [
    { value: "PENDING", label: "Pending" },
    { value: "ACCEPTED", label: "Accepted" },
    { value: "HOLD", label: "Hold" },
    { value: "REJECTED", label: "Rejected" }
  ],
  orderStatuses: [
    { value: "CREATED", label: "Created" },
    { value: "IN_PRODUCTION", label: "In Production" },
    { value: "READY_FOR_DISPATCH", label: "Ready for Dispatch" },
    { value: "PARTIALLY_DISPATCHED", label: "Partially Dispatched" },
    { value: "COMPLETED", label: "Completed" }
  ],
  productionStatuses: [
    { value: "PENDING", label: "Not Started" },
    { value: "IN_PROGRESS", label: "Started" },
    { value: "HOLD", label: "Hold" },
    { value: "COMPLETED", label: "Completed" }
  ],
  shipmentStatuses: [
    { value: "PACKING", label: "Packed" },
    { value: "SHIPPED", label: "Dispatched" },
    { value: "DELIVERED", label: "Delivered" }
  ],
  units: [
    { value: "KG", label: "KG" },
    { value: "MT", label: "MT" },
    { value: "LTR", label: "LTR" }
  ],
  modeOfEnquiry: [
    { value: "Phone", label: "Phone" },
    { value: "Whatsapp", label: "Whatsapp" },
    { value: "Website", label: "Website" },
    { value: "We Reached Out", label: "We Reached Out" },
    { value: "Walk-in", label: "Walk-in" },
    { value: "Other", label: "Other" }
  ],
  assignedPersons: [
    { value: "Sharun Mittal", label: "Sharun Mittal" },
    { value: "Saumya Mittal", label: "Saumya Mittal" },
    { value: "Ravishu Mittal", label: "Ravishu Mittal" },
    { value: "Ankesh Jain", label: "Ankesh Jain" },
    { value: "Shrinivas Potukuchi", label: "Shrinivas Potukuchi" }
  ],
  companyNames: [],
  enquiryMaster: [],
  customerMaster: [],
  countryCodes: [{ value: "IN", label: "IN" }],
  products: []
};
const MASTER_DATA_CACHE_KEY = "fms_master_data_v3";
const MASTER_DATA_TTL_MS = 5 * 60 * 1000;

let memoryCache = {
  data: DEFAULT_MASTER_DATA,
  fetchedAt: 0
};
let inFlightRequest = null;

function normalizeOptions(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;

  const fallbackMap = new Map(
    fallback
      .map((item) => {
        if (typeof item === "string") return [item, item];
        if (item && typeof item === "object" && item.value != null) {
          return [String(item.value), String(item.label ?? item.value)];
        }
        return null;
      })
      .filter(Boolean)
  );

  return value
    .map((item) => {
      if (typeof item === "string") {
        const valueString = item;
        return { value: valueString, label: fallbackMap.get(valueString) ?? valueString };
      }
      if (item && typeof item === "object" && item.value != null) {
        return {
          value: String(item.value),
          label: String(item.label ?? item.value)
        };
      }
      return null;
    })
    .filter(Boolean);
}

function buildMasterDataFromResponse(previousData, responseData) {
  const prev = previousData || DEFAULT_MASTER_DATA;
  const data = responseData && typeof responseData === "object" ? responseData : {};
  const productionStatuses = normalizeOptions(data.productionStatuses, prev.productionStatuses).map((item) => {
    if (item.value === "PENDING") return { ...item, label: "Not Started" };
    if (item.value === "IN_PROGRESS") return { ...item, label: "Started" };
    if (item.value === "HOLD") return { ...item, label: "Hold" };
    if (item.value === "COMPLETED") return { ...item, label: "Completed" };
    return item;
  });
  const orderStatuses = normalizeOptions(data.orderStatuses, prev.orderStatuses).map((item) => {
    if (item.value === "CREATED") return { ...item, label: "Created" };
    if (item.value === "IN_PRODUCTION") return { ...item, label: "In Production" };
    if (item.value === "READY_FOR_DISPATCH") return { ...item, label: "Ready for Dispatch" };
    if (item.value === "PARTIALLY_DISPATCHED") return { ...item, label: "Partially Dispatched" };
    if (item.value === "COMPLETED") return { ...item, label: "Completed" };
    if (item.value === "DISPATCHED") return { ...item, label: "Completed" };
    return item;
  });
  const shipmentStatuses = normalizeOptions(data.shipmentStatuses, prev.shipmentStatuses).map((item) =>
    item.value === "PACKING"
      ? { ...item, label: "Packed" }
      : item.value === "SHIPPED"
        ? { ...item, label: "Dispatched" }
        : item
  );
  return {
    ...prev,
    roles: normalizeOptions(data.roles, prev.roles),
    enquiryStatuses: normalizeOptions(data.enquiryStatuses, prev.enquiryStatuses),
    orderStatuses,
    productionStatuses,
    shipmentStatuses,
    units: normalizeOptions(data.units, prev.units),
    modeOfEnquiry: normalizeOptions(data.modeOfEnquiry, prev.modeOfEnquiry),
    assignedPersons: normalizeOptions(data.assignedPersons, prev.assignedPersons),
    companyNames: normalizeOptions(data.companyNames, prev.companyNames),
    enquiryMaster: Array.isArray(data.enquiryMaster) ? data.enquiryMaster : prev.enquiryMaster,
    customerMaster: Array.isArray(data.customerMaster) ? data.customerMaster : prev.customerMaster,
    countryCodes: normalizeOptions(data.countryCodes, prev.countryCodes),
    products: normalizeOptions(data.products, prev.products)
  };
}

function readCachedMasterData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(MASTER_DATA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.data || typeof parsed.data !== "object") return null;
    return {
      data: buildMasterDataFromResponse(DEFAULT_MASTER_DATA, parsed.data),
      fetchedAt: Number(parsed.fetchedAt || 0)
    };
  } catch {
    return null;
  }
}

function writeCachedMasterData(cache) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      MASTER_DATA_CACHE_KEY,
      JSON.stringify({ data: cache.data, fetchedAt: cache.fetchedAt })
    );
  } catch {
    // Ignore storage failures and continue using memory cache only.
  }
}

const persistedCache = readCachedMasterData();
if (persistedCache) {
  memoryCache = persistedCache;
}

async function getMasterData({ force = false } = {}) {
  const now = Date.now();
  if (!force && memoryCache.fetchedAt > 0 && now - memoryCache.fetchedAt < MASTER_DATA_TTL_MS) {
    return memoryCache.data;
  }

  if (inFlightRequest) {
    return inFlightRequest;
  }

  inFlightRequest = api.get("/master-data")
    .then(({ data }) => {
      memoryCache = {
        data: buildMasterDataFromResponse(memoryCache.data, data),
        fetchedAt: Date.now()
      };
      writeCachedMasterData(memoryCache);
      return memoryCache.data;
    })
    .catch(() => memoryCache.data)
    .finally(() => {
      inFlightRequest = null;
    });

  return inFlightRequest;
}

export default function useMasterData() {
  const [masterData, setMasterData] = useState(() => memoryCache.data || DEFAULT_MASTER_DATA);

  useEffect(() => {
    let cancelled = false;

    async function fetchMasterData() {
      const resolved = await getMasterData();
      if (cancelled) return;
      setMasterData(resolved || DEFAULT_MASTER_DATA);
    }

    fetchMasterData();
    const onMasterDataUpdated = () => {
      getMasterData({ force: true }).then((resolved) => {
        if (cancelled) return;
        setMasterData(resolved || DEFAULT_MASTER_DATA);
      });
    };
    window.addEventListener("master-data-updated", onMasterDataUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("master-data-updated", onMasterDataUpdated);
    };
  }, []);

  return masterData;
}
