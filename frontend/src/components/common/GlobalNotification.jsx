import { useEffect, useState } from "react";

function getVariantStyles(variant) {
  if (variant === "success") {
    return {
      background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
      borderColor: "#10b981",
      titleColor: "#065f46",
      textColor: "#064e3b"
    };
  }

  if (variant === "warning") {
    return {
      background: "linear-gradient(135deg, #fffbeb 0%, #fde68a 100%)",
      borderColor: "#f59e0b",
      titleColor: "#92400e",
      textColor: "#78350f"
    };
  }

  return {
    background: "linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)",
    borderColor: "#ef4444",
    titleColor: "#991b1b",
    textColor: "#7f1d1d"
  };
}

function GlobalNotification() {
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    let timerId = null;

    const onNotification = (event) => {
      const detail = event?.detail || {};
      const nextNotification = {
        id: Date.now() + Math.random(),
        title: detail.title || "Notice",
        message: detail.message || "Something went wrong.",
        variant: detail.variant || "error"
      };

      setNotification(nextNotification);
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(() => {
        setNotification((current) => (current?.id === nextNotification.id ? null : current));
      }, 5000);
    };

    window.addEventListener("fms-notification", onNotification);

    return () => {
      window.removeEventListener("fms-notification", onNotification);
      if (timerId) window.clearTimeout(timerId);
    };
  }, []);

  if (!notification) return null;

  const styles = getVariantStyles(notification.variant);

  return (
    <div
      aria-live="polite"
      style={{
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: 10000,
        width: "min(360px, calc(100vw - 32px))"
      }}
    >
      <div
        role="status"
        style={{
          border: `1px solid ${styles.borderColor}`,
          borderRadius: "16px",
          padding: "14px 16px",
          background: styles.background,
          boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)",
          color: styles.textColor
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <strong style={{ display: "block", color: styles.titleColor, marginBottom: "4px" }}>
              {notification.title}
            </strong>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.5 }}>
              {notification.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            aria-label="Dismiss notification"
            style={{
              border: "none",
              background: "transparent",
              color: styles.titleColor,
              fontSize: "20px",
              lineHeight: 1,
              cursor: "pointer",
              padding: 0
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export default GlobalNotification;
