// The stored category codes that decide which inventory screen an item shows
// up on. Product Master, purchase orders and the inventory screens all key off
// these exact strings, so they live in one place — a free-text category that
// doesn't match one of these lands the item in Finished Goods by default.
export const INVENTORY_CATEGORY_OPTIONS = [
  { value: "RAW_MATERIAL", label: "Raw Material" },
  { value: "PACKING_MATERIAL", label: "Packing Material" },
  { value: "FINISHED_GOODS", label: "Finished Goods" }
];

const LABEL_BY_VALUE = new Map(INVENTORY_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

export function inventoryCategoryLabel(value) {
  return LABEL_BY_VALUE.get(value) || value || "";
}
