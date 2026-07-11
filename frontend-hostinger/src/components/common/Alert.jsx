function Alert({ variant = "error", children, onDismiss }) {
  if (!children) return null;

  return (
    <div className={`ui-alert ui-alert-${variant}`} role="status">
      <div>{children}</div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            border: "none",
            background: "transparent",
            color: "inherit",
            fontSize: "16px",
            lineHeight: 1,
            cursor: "pointer",
            padding: 0
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export default Alert;
