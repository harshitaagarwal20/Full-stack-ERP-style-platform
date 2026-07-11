function MobileListCard({
  title,
  subtitle,
  fields,
  badge,
  badgeColor,
  onActionClick,
  actionLabel,
  onClick,
  className = ""
}) {
  return (
    <div
      className={`mobile-list-card ${className}`}
      onClick={onClick}
    >
      <div className="mobile-card-header">
        <div className="mobile-card-title-section">
          <h3 className="mobile-card-title">{title}</h3>
          {subtitle && <p className="mobile-card-subtitle">{subtitle}</p>}
        </div>
        {badge && (
          <span className={`mobile-card-badge mobile-card-badge-${badgeColor || 'default'}`}>
            {badge}
          </span>
        )}
      </div>

      <div className="mobile-card-fields">
        {fields.map((field, idx) => (
          <div key={idx} className="mobile-card-field">
            <span className="mobile-card-label">{field.label}</span>
            <span className="mobile-card-value">{field.value}</span>
          </div>
        ))}
      </div>

      {onActionClick && (
        <button
          className="mobile-card-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            onActionClick();
          }}
        >
          {actionLabel || "View"}
        </button>
      )}
    </div>
  );
}

export default MobileListCard;
