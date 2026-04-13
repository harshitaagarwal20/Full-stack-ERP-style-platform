import { PlusIcon } from "../../erp/ErpIcons";

function FloatingButton({ label, onClick }) {
  return (
    <button className="mapp-fab" onClick={onClick} aria-label={label}>
      <PlusIcon />
      <span>{label}</span>
    </button>
  );
}

export default FloatingButton;
