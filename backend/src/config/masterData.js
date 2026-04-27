export const RAW_MASTER_DATA = {
  roles: ["admin", "sales", "production", "dispatch"],
  enquiryStatuses: ["PENDING", "ACCEPTED", "HOLD", "REJECTED"],
  orderStatuses: ["CREATED", "IN_PRODUCTION", "READY_FOR_DISPATCH", "PARTIALLY_DISPATCHED", "COMPLETED"],
  productionStatuses: ["PENDING", "IN_PROGRESS", "HOLD", "COMPLETED"],
  shipmentStatuses: ["PACKING", "SHIPPED", "DELIVERED"],
  units: ["KG", "MT", "LTR"],
  modeOfEnquiry: ["Phone", "Whatsapp", "Website", "We Reached Out", "Walk-in", "Other"],
  assignedPersons: [
    "Sharun Mittal",
    "Saumya Mittal",
    "Ravishu Mittal",
    "Ankesh Jain",
    "Shrinivas Potukuchi"
  ],
  companyNames: [],
  products: [
    "ALUMINIUM STEARATE",
    "ANTIBLOCKING AGENT",
    "BARIUM STEARATE",
    "Butyl Stearate",
    "CALCIUM 12-HYDROXY STEARATE",
    "CALCIUM STEARATE",
    "CALCIUM ZINC STABILIZER",
    "Calcium Zinc Stearate",
    "Cetyl-Stearyl Alcohols",
    "EGDS",
    "GMS 40",
    "GMS 90",
    "GMS 95",
    "GMS 97",
    "HSA 12 MAGNESIUM STEARATE",
    "Isostearic Acid",
    "Lithium 12-Hydroxystearate",
    "Lithium Stearate",
    "MAGNESIUM STEARATE",
    "Manganese Stearate",
    "Neutral Polymer",
    "NIMAID EBS",
    "NIMLUB - 187",
    "NIMLUB - T",
    "NIMLUB CZ 50",
    "NIMLUB NR6",
    "NIMPHOB",
    "NIMSTAT N66",
    "NUWAX",
    "OXO-BIODEGRADABLE ADDITIVE",
    "PE WAX",
    "PE WAX-500",
    "Pentaerythritol Tetrastearate (PETS)",
    "Potassium Octadecanoate",
    "Sodium Benzoate",
    "Sodium Octadecanoate",
    "STEARIC ACID",
    "TALC",
    "Ultra 8100",
    "ZINC 12-HYDROXY STEARATE",
    "Zinc Laurate",
    "ZINC OXIDE",
    "Zinc salt of fatty acids",
    "ZINC STEARATE",
    "Zinc Stearate",
    "ABC"
  ],
  countryCodes: ["IN"]
};

function toOptions(values) {
  return values.map((value) => ({ value, label: String(value) }));
}

const PRODUCTION_STATUS_OPTIONS = [
  { value: "PENDING", label: "Not Started" },
  { value: "IN_PROGRESS", label: "Started" },
  { value: "HOLD", label: "Hold" },
  { value: "COMPLETED", label: "Completed" }
];

const SHIPMENT_STATUS_OPTIONS = [
  { value: "PACKING", label: "Packed" },
  { value: "SHIPPED", label: "Dispatched" },
  { value: "DELIVERED", label: "Delivered" }
];

export const MASTER_DATA = {
  roles: toOptions(RAW_MASTER_DATA.roles),
  enquiryStatuses: toOptions(RAW_MASTER_DATA.enquiryStatuses),
  orderStatuses: toOptions(RAW_MASTER_DATA.orderStatuses),
  productionStatuses: PRODUCTION_STATUS_OPTIONS,
  shipmentStatuses: SHIPMENT_STATUS_OPTIONS,
  units: toOptions(RAW_MASTER_DATA.units),
  modeOfEnquiry: toOptions(RAW_MASTER_DATA.modeOfEnquiry),
  assignedPersons: toOptions(RAW_MASTER_DATA.assignedPersons),
  companyNames: toOptions(RAW_MASTER_DATA.companyNames),
  products: toOptions(RAW_MASTER_DATA.products),
  countryCodes: toOptions(RAW_MASTER_DATA.countryCodes)
};

export default MASTER_DATA;
export const MASTER_DATA_CATEGORIES = Object.freeze(Object.keys(MASTER_DATA));
