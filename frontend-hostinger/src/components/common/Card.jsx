function Card({ children, className = "", style }) {
  return (
    <section className={`ui-card ${className}`.trim()} style={style}>
      {children}
    </section>
  );
}

export default Card;
