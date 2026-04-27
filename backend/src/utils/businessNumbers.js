function padId(value, length = 6) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "0".repeat(length);
  }
  return String(numeric).padStart(length, "0");
}

function padSalesGroupId(value) {
  return padId(value, 3);
}

function padSalesOrderId(value) {
  return padId(value, 4);
}

function normalizeSalesPrefix(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return normalized.replace(/^[A-Z]+[-_]?/i, "SO_");
}

export function extractSalesGroupSequence(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^SO[_-](\d+)$/i);
  if (!match) return 0;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatSalesGroupNumber(sequence) {
  const numeric = Number(sequence);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `SO_${padSalesGroupId(numeric)}`;
}

export function formatEnquiryNumber(id) {
  const numeric = Number(id);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `ENQ_${padId(numeric, 4)}`;
}

export function generateBusinessNumber(prefix) {
  const stamp = Date.now();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${suffix}`;
}

export function generateEnquiryNumber() {
  return generateBusinessNumber("ENQ");
}

export function formatManualOrderRequestNumber(sequence) {
  return `MOR_${padId(sequence, 4)}`;
}

export function generateSalesGroupNumber(enquiryNumber) {
  const normalized = String(enquiryNumber || "").trim();
  if (!normalized) {
    return normalizeSalesPrefix(generateBusinessNumber("SO"));
  }
  return normalizeSalesPrefix(normalized);
}

export function normalizeSalesGroupNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const sequence = extractSalesGroupSequence(normalized);
  if (sequence > 0) {
    return formatSalesGroupNumber(sequence);
  }
  return normalizeSalesPrefix(normalized);
}

export function getSalesGroupNumberFromEnquiry(enquiry) {
  if (!enquiry) return "";
  return normalizeSalesGroupNumber(enquiry.salesGroupNumber || enquiry.order?.salesGroupNumber);
}

export function formatSalesOrderNumber(id) {
  return `SO_${padSalesOrderId(id)}`;
}

export function getDisplayEnquiryNumber(enquiry) {
  if (!enquiry) return "";
  return formatEnquiryNumber(enquiry.id) || enquiry.enquiryNumber || `ENQ_${padId(enquiry.id)}`;
}

export function getDisplaySalesNumber(order) {
  if (!order) return "";
  return normalizeSalesGroupNumber(order.salesGroupNumber || order.salesOrderNumber || formatSalesOrderNumber(order.id));
}
