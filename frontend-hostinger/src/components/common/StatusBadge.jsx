const DEFAULT_STYLE = { background: "#e2e8f0", color: "#475569" };

function StatusBadge({ status, config = {} }) {
  const entry = config[status];
  const label = entry?.label || status || "-";
  const style = {
    background: entry?.background || DEFAULT_STYLE.background,
    color: entry?.color || DEFAULT_STYLE.color,
    ...(entry?.border ? { border: entry.border } : {})
  };

  return (
    <span className="ui-badge" style={style}>
      {label}
    </span>
  );
}

export default StatusBadge;
