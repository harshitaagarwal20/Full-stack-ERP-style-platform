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
        .map((product) => ({ product, grade: "", quantity: "", unit_of_measurement: "" }));
    }
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        const product = normalizeText(item);
        return product ? { product, grade: "", quantity: "", unit_of_measurement: "" } : null;
      }

      if (item && typeof item === "object") {
        const product = normalizeText(item.product ?? item.value ?? item.name);
        const grade = normalizeText(item.grade);
        const quantity = String(item.quantity ?? "").trim();
        const unit_of_measurement = normalizeText(item.unit_of_measurement ?? item.unit ?? item.measurement);
        return product ? { product, grade, quantity, unit_of_measurement } : null;
      }

      return null;
    })
    .filter(Boolean);
}

export function normalizeEnquiryProducts(value) {
  return normalizeEnquiryProductRows(value).map((row) => row.product);
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
        return pieces.join(" - ");
      })
      .join(", ");
  }

  return normalizeText(enquiry?.product);
}
