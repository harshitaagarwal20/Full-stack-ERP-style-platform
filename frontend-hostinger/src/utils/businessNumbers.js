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

function extractSalesGroupSequence(value) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^SO[_-](\d+)$/i);
  if (!match) return 0;
  const numeric = Number(match[1]);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatSalesGroupNumber(sequence) {
  const numeric = Number(sequence);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `SO_${padSalesGroupId(numeric)}`;
}

function normalizeSalesGroupNumber(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  const sequence = extractSalesGroupSequence(normalized);
  if (sequence > 0) {
    return formatSalesGroupNumber(sequence);
  }
  return normalizeSalesPrefix(normalized);
}

function formatEnquiryNumber(id) {
  const numeric = Number(id);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "";
  }
  return `ENQ_${padId(numeric, 4)}`;
}

function getSalesDisplayNumber(order) {
  if (!order) return "";
  return normalizeSalesGroupNumber(order.salesGroupNumber || order.salesOrderNumber || `SO_${padSalesOrderId(order.id)}`);
}

export function getDisplayEnquiryNumber(enquiry) {
  if (!enquiry) return "";
  return formatEnquiryNumber(enquiry.id) || enquiry.enquiryNumber || `ENQ_${padId(enquiry.id)}`;
}

export function getDisplaySalesNumber(order) {
  return getSalesDisplayNumber(order);
}

export function getDisplaySalesGroupNumber(order) {
  return getSalesDisplayNumber(order);
}

export function getDisplayManualOrderRequestNumber(request) {
  if (!request) return "";
  return request.requestNumber || `MOR_${padId(request.id, 4)}`;
}
