import { useEffect, useState } from "react";
import SearchableSelect from "../common/SearchableSelect";

// Sheets filled in before the time pickers existed may hold free text
// ("10:30 AM", "after lunch"). A type="time" input would silently drop those, so
// only use the picker when the stored value is a real HH:MM.
const isTimeValue = (value) => !value || /^\d{2}:\d{2}$/.test(value);

function Field({ field, draft, onChange }) {
  const value = draft[field.key] ?? "";

  // A field may pull other fields across with it — picking a product on a GRN
  // sheet carries its batch and supplier, which are the same consignment line.
  const set = (next) => onChange(field.key, next, field.derive?.(next, draft));

  const common = {
    className: "input",
    autoComplete: "off",
    value,
    onChange: (event) => set(event.target.value)
  };

  if (field.type === "searchable") {
    return (
      <SearchableSelect
        options={field.options}
        value={value}
        onChange={set}
        placeholder={field.placeholder}
        allowCustom={field.allowCustom}
      />
    );
  }

  if (field.type === "select") {
    return (
      <select {...common}>
        <option value="">—</option>
        {field.options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
        {/* A value saved before these options existed must not vanish on edit. */}
        {value && !field.options.includes(value) && <option value={value}>{value}</option>}
      </select>
    );
  }

  if (field.type === "time") {
    return isTimeValue(value) ? <input {...common} type="time" /> : <input {...common} />;
  }

  if (field.type === "date") {
    return <input {...common} type="date" min={field.min?.(value)} />;
  }

  if (field.type === "number") {
    return <input {...common} type="number" min={field.min ?? 0} max={field.max?.(draft)} />;
  }

  if (field.type === "decimal") {
    return <input {...common} inputMode="decimal" />;
  }

  return <input {...common} />;
}

// One entry at a time, with the sheet's many columns grouped into the few things
// a person actually does at the bench. The printed sheet still carries every
// column — this is only how the data gets in.
function SampleFormModal({ title, sections, value, onSave, onCancel }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  const setField = (key, fieldValue, derived) => {
    setDraft((prev) => ({ ...prev, [key]: fieldValue, ...(derived || {}) }));
  };

  return (
    <div className="masterdata-modal-overlay" onClick={onCancel}>
      <div className="sample-modal" onClick={(event) => event.stopPropagation()}>
        <div className="sample-modal-head">
          <h3>{title}</h3>
          <button type="button" className="sample-modal-close" onClick={onCancel} aria-label="Close">×</button>
        </div>

        <div className="sample-modal-body">
          {sections.map((section) => (
            <fieldset key={section.title} className="sample-section">
              <legend>{section.title}</legend>
              <div className="sample-section-grid">
                {section.fields.map((field) => (
                  <label key={field.key} className={field.wide ? "sample-field sample-field-wide" : "sample-field"}>
                    <span>{field.label}</span>
                    <Field field={field} draft={draft} onChange={setField} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <div className="sample-modal-foot">
          <button type="button" className="order-btn-secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="order-btn-primary" onClick={() => onSave(draft)}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default SampleFormModal;
