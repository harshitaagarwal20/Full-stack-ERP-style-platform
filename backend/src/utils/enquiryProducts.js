function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeProductGradePair(item) {
  if (typeof item === "string") {
    const product = normalizeText(item);
    return product ? { product, grade: "", quantity: "", unit_of_measurement: "", price_per_uom: "", packaging_requirement: "", remark: "" } : null;
  }

  if (!item || typeof item !== "object") {
    return null;
  }

  const product = normalizeText(item.product ?? item.value ?? item.name ?? item.label);
  if (!product) return null;

  return {
    product,
    grade: normalizeText(item.grade),
    quantity: String(item.quantity ?? "").trim(),
    unit_of_measurement: normalizeText(item.unit_of_measurement ?? item.unit ?? item.measurement),
    price_per_uom: String(item.price_per_uom ?? item.pricePerUom ?? "").trim(),
    packaging_requirement: normalizeText(item.packaging_requirement ?? item.packagingRequirement ?? item.packaging_req ?? item.packagingReq),
    remark: normalizeText(item.remark ?? item.remarks ?? item.note ?? item.notes)
  };
}

export function normalizeEnquiryProductRows(value) {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return rawValues
    .map(normalizeProductGradePair)
    .filter(Boolean);
}

export function normalizeEnquiryProducts(value) {
  const seen = new Set();
  return normalizeEnquiryProductRows(value).reduce((products, item) => {
    const key = item.product.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      products.push(item.product);
    }
    return products;
  }, []);
}

export function formatEnquiryProducts(products, fallback = "") {
  const normalizedProducts = normalizeEnquiryProductRows(products);
  if (normalizedProducts.length > 0) {
    return normalizedProducts
      .map((item) => {
        const pieces = [item.product];
        if (item.grade) pieces.push(item.grade);
        if (item.quantity) {
          pieces.push(item.unit_of_measurement ? `${item.quantity} ${item.unit_of_measurement}` : item.quantity);
        }
        if (item.packaging_requirement) pieces.push(`Packaging: ${item.packaging_requirement}`);
        return pieces.join(" - ");
      })
      .join(", ");
  }

  const normalizedFallback = normalizeEnquiryProductRows(fallback);
  if (normalizedFallback.length > 0) {
    return normalizedFallback
      .map((item) => {
        const pieces = [item.product];
        if (item.grade) pieces.push(item.grade);
        if (item.quantity) {
          pieces.push(item.unit_of_measurement ? `${item.quantity} ${item.unit_of_measurement}` : item.quantity);
        }
        if (item.packaging_requirement) pieces.push(`Packaging: ${item.packaging_requirement}`);
        return pieces.join(" - ");
      })
      .join(", ");
  }

  return normalizeText(fallback);
}

export function getPrimaryEnquiryProduct(enquiry) {
  const primary = getPrimaryEnquiryProductRow(enquiry);
  if (primary?.product) return primary.product;

  return normalizeEnquiryProducts(enquiry?.product)[0] || normalizeText(enquiry?.product);
}

export function getPrimaryEnquiryProductRow(enquiry) {
  const products = normalizeEnquiryProductRows(enquiry?.products);
  if (products.length > 0) return products[0];

  const product = normalizeEnquiryProducts(enquiry?.product)[0] || normalizeText(enquiry?.product);
  return product ? { product, grade: "", quantity: "", unit_of_measurement: "", packaging_requirement: "", remark: "" } : null;
}
