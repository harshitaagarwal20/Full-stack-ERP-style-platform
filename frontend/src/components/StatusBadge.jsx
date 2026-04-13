const styles = {
  PENDING: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-blue-100 text-blue-800",
  HOLD: "bg-orange-100 text-orange-800",
  REJECTED: "bg-red-100 text-red-800",
  CREATED: "bg-blue-100 text-blue-800",
  IN_PRODUCTION: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  DISPATCHED: "bg-emerald-100 text-emerald-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  PACKING: "bg-amber-100 text-amber-800",
  SHIPPED: "bg-blue-100 text-blue-800",
  DELIVERED: "bg-emerald-100 text-emerald-800"
};

function StatusBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[value] || "bg-slate-100 text-slate-700"}`}>
      {String(value || "-").replaceAll("_", " ")}
    </span>
  );
}

export default StatusBadge;
