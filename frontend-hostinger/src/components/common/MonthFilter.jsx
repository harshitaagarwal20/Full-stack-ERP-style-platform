import { useMemo } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

// How far back the dropdown goes. Anything older is still selectable — an
// out-of-range value already on the filter is prepended so it stays visible.
const MONTHS_BACK = 24;

function toMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(monthValue) {
  const [year, month] = String(monthValue).split("-").map(Number);
  if (!year || !month || month < 1 || month > 12) return monthValue;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Replaces <input autoComplete="off" type="month">, which renders as an empty "----------, ----"
// box until it is filled in. Lists real month names instead.
export default function MonthFilter({ value, onChange, title, className = "input", placeholder = "All Months" }) {
  const options = useMemo(() => {
    const today = new Date();
    const months = [];
    for (let offset = 0; offset < MONTHS_BACK; offset += 1) {
      months.push(toMonthValue(new Date(today.getFullYear(), today.getMonth() - offset, 1)));
    }
    if (value && !months.includes(value)) months.unshift(value);
    return months;
  }, [value]);

  return (
    <select
      className={className}
      title={title}
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((month) => (
        <option key={month} value={month}>{toMonthLabel(month)}</option>
      ))}
    </select>
  );
}
