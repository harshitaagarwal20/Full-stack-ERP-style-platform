const classMap = {
  CREATED: "created",
  APPROVED: "approved",
  IN_PRODUCTION: "in-production",
  IN_PROGRESS: "in-production",
  COMPLETED: "completed",
  DISPATCHED: "completed",
  PENDING: "pending",
  SHIPPED: "approved",
  DELIVERED: "completed",
  REJECTED: "rejected"
};

function MobileStatusBadge({ value }) {
  const normalized = (value || "CREATED").toString().toUpperCase();
  const className = classMap[normalized] || "created";
  const label = normalized.replaceAll("_", " ");
  return <span className={`mapp-status ${className}`}>{label}</span>;
}

export default MobileStatusBadge;
