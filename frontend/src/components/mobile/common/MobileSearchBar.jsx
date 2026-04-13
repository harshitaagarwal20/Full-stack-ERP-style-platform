import { SearchIcon } from "../../erp/ErpIcons";

function MobileSearchBar({ value, onChange, onSubmit, placeholder }) {
  return (
    <div className="mapp-search">
      <SearchIcon />
      <input value={value} onChange={onChange} placeholder={placeholder} onKeyDown={(event) => event.key === "Enter" && onSubmit?.()} />
      {onSubmit && <button className="mapp-btn mapp-btn-ghost" onClick={onSubmit}>Search</button>}
    </div>
  );
}

export default MobileSearchBar;
