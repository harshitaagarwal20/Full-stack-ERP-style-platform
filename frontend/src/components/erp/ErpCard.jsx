function ErpCard({ icon, value, label, accent = "blue", size = "md" }) {
  return (
    <article className={`erp-stat-card ${accent} ${size}`}>
      <div className="erp-stat-icon">{icon}</div>
      <div>
        <p className="erp-stat-value">{value}</p>
        <p className="erp-stat-label">{label}</p>
      </div>
    </article>
  );
}

export default ErpCard;
