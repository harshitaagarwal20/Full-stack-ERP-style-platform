export function normalizeApprovalStatus(source, status) {
  if (source === "manual") {
    if (status === "REQUESTED") return "PENDING";
    if (status === "APPROVED" || status === "ORDER_CREATED") return "ACCEPTED";
    if (status === "REJECTED") return "REJECTED";
  }

  return status || "PENDING";
}

export function getApprovalListParams(statusFilter) {
  const normalized = String(statusFilter || "PENDING").trim().toUpperCase();

  if (normalized === "ALL") {
    return {
      enquiryParams: {},
      manualParams: {}
    };
  }

  if (normalized === "PENDING") {
    return {
      enquiryParams: { status: "PENDING" },
      manualParams: { status: "REQUESTED" }
    };
  }

  if (normalized === "ACCEPTED") {
    return {
      enquiryParams: { status: "ACCEPTED" },
      manualParams: {}
    };
  }

  if (normalized === "REJECTED") {
    return {
      enquiryParams: { status: "REJECTED" },
      manualParams: { status: "REJECTED" }
    };
  }

  return {
    enquiryParams: { status: normalized },
    manualParams: { status: normalized }
  };
}
