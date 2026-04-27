import { getMasterData } from "../services/masterDataService.js";

export function normalizeProductValue(value) {
  return String(value || "").trim();
}

export function normalizeProductList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") {
          return normalizeProductValue(item);
        }

        if (item && typeof item === "object") {
          return normalizeProductValue(item.product ?? item.value ?? item.name);
        }

        return "";
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(normalizeProductValue)
      .filter(Boolean);
  }

  return [];
}

export async function getProductCatalogSet() {
  const masterData = await getMasterData();
  const products = Array.isArray(masterData.products) ? masterData.products : [];
  return new Set(products.map((item) => normalizeProductValue(item.value).toLowerCase()).filter(Boolean));
}

export async function ensureProductsExist(products, { allowEmpty = false } = {}) {
  const normalized = normalizeProductList(products);

  if (!normalized.length) {
    if (allowEmpty) return normalized;
    const error = new Error("Select at least one product.");
    error.statusCode = 400;
    throw error;
  }

  const catalog = await getProductCatalogSet();
  const invalid = normalized.filter((item) => !catalog.has(item.toLowerCase()));

  if (invalid.length > 0) {
    const error = new Error(`Invalid product selection: ${invalid.join(", ")}.`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
}
