function normalizeText(value) {
  return String(value || "").trim();
}

export function normalizeEnquiryProductRows(value) {
  if (!Array.isArray(value)) {
    if (typeof value === "string") {
      return value
        .split(",")
        .map(normalizeText)
        .filter(Boolean)
        .map((product) => ({ product, grade: "", quantity: "", unit_of_measurement: "", price_per_uom: "", packaging_requirement: "", remark: "" }));
    }
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const product = normalizeText(item);
        return product ? { product, grade: "", quantity: "", unit_of_measurement: "", price_per_uom: "", packaging_requirement: "", remark: "" } : null;
      }

      if (item && typeof item === "object") {
        const product = normalizeText(item.product ?? item.value ?? item.name);
        const grade = normalizeText(item.grade);
        const quantity = String(item.quantity ?? "").trim();
        const unit_of_measurement = normalizeText(item.unit_of_measurement ?? item.unit ?? item.measurement);
        const price_per_uom = String(item.price_per_uom ?? item.pricePerUom ?? "").trim();
        const packaging_requirement = normalizeText(item.packaging_requirement ?? item.packagingRequirement ?? item.packaging_req ?? item.packagingReq);
        const remark = normalizeText(item.remark ?? item.remarks ?? item.note ?? item.notes);
        return product ? { product, grade, quantity, unit_of_measurement, price_per_uom, packaging_requirement, remark } : null;
      }

      return null;
    })
    .filter(Boolean);
}

export function normalizeEnquiryProducts(value) {
  return normalizeEnquiryProductRows(value).map((row) => row.product);
}

// Just the product names, comma-separated. formatEnquiryProducts() glues grade
// and quantity into each name ("ZINC OXIDE - ABC - 100 KG"), which reads as a
// nonsense product wherever grade and quantity already have columns of their
// own. Use this in tables; use the formatter only where the whole line has to
// stand alone in one string.
export function formatEnquiryProductNames(enquiry) {
  const rows = normalizeEnquiryProductRows(enquiry?.products ?? enquiry);
  if (rows.length > 0) {
    return rows.map((row) => row.product).join(", ");
  }

  return normalizeText(enquiry?.product);
}

export function formatEnquiryProducts(enquiry) {
  const rows = normalizeEnquiryProductRows(enquiry?.products ?? enquiry);
  if (rows.length > 0) {
    return rows
      .map((row) => {
        const pieces = [row.product];
        if (row.grade) pieces.push(row.grade);
        if (row.quantity) {
          pieces.push(row.unit_of_measurement ? `${row.quantity} ${row.unit_of_measurement}` : row.quantity);
        }
        if (row.packaging_requirement) pieces.push(`Packaging: ${row.packaging_requirement}`);
        return pieces.join(" - ");
      })
      .join(", ");
  }

  return normalizeText(enquiry?.product);
}
