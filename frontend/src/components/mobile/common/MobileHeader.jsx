function MobileHeader({ title, actionLabel, onAction }) {
  return (
    <div className="mapp-section-head">
      <h2>{title}</h2>
      {actionLabel && onAction && (
        <button className="mapp-btn mapp-btn-primary" onClick={onAction}>{actionLabel}</button>
      )}
    </div>
  );
}

export default MobileHeader;
