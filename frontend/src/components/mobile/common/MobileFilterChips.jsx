function MobileFilterChips({ options, value, onChange }) {
  return (
    <div className="mapp-chip-row">
      {options.map((option) => (
        <button
          key={option.value}
          className={`mapp-chip ${value === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default MobileFilterChips;
