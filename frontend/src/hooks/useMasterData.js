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
    { value: "DISPATCHED", label: "Dispatched" },
    { value: "COMPLETED", label: "Completed" }
  ],
  productionStatuses: [
    { value: "PENDING", label: "Pending" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "COMPLETED", label: "Completed" }
  ],
  shipmentStatuses: [
    { value: "PACKING", label: "Pending" },
    { value: "SHIPPED", label: "In Transit" },
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

function normalizeOptions(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => {
      if (typeof item === "string") return { value: item, label: item };
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

export default function useMasterData() {
  const [masterData, setMasterData] = useState(DEFAULT_MASTER_DATA);

  useEffect(() => {
    let cancelled = false;

    async function fetchMasterData() {
      try {
        const { data } = await api.get("/master-data");
        if (cancelled || !data || typeof data !== "object") return;

        setMasterData((prev) => ({
          ...prev,
          roles: normalizeOptions(data.roles, prev.roles),
          enquiryStatuses: normalizeOptions(data.enquiryStatuses, prev.enquiryStatuses),
          orderStatuses: normalizeOptions(data.orderStatuses, prev.orderStatuses),
          productionStatuses: normalizeOptions(data.productionStatuses, prev.productionStatuses),
          shipmentStatuses: normalizeOptions(data.shipmentStatuses, prev.shipmentStatuses),
          units: normalizeOptions(data.units, prev.units),
          modeOfEnquiry: normalizeOptions(data.modeOfEnquiry, prev.modeOfEnquiry),
          assignedPersons: normalizeOptions(data.assignedPersons, prev.assignedPersons),
          companyNames: normalizeOptions(data.companyNames, prev.companyNames),
          enquiryMaster: Array.isArray(data.enquiryMaster) ? data.enquiryMaster : prev.enquiryMaster,
          customerMaster: Array.isArray(data.customerMaster) ? data.customerMaster : prev.customerMaster,
          countryCodes: normalizeOptions(data.countryCodes, prev.countryCodes),
          products: normalizeOptions(data.products, prev.products)
        }));
      } catch {
        // Keep local defaults when master data endpoint is unavailable.
      }
    }

    fetchMasterData();
    const onMasterDataUpdated = () => {
      fetchMasterData();
    };
    window.addEventListener("master-data-updated", onMasterDataUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("master-data-updated", onMasterDataUpdated);
    };
  }, []);

  return masterData;
}
