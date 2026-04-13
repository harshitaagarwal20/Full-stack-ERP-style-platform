function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsv(value) {
  const raw = normalizeValue(value);
  const escaped = raw.replace(/"/g, "\"\"");
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function exportRowsToExcel(filename, columns, rows) {
  const header = columns.map((column) => escapeCsv(column.header)).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCsv(row[column.key])).join(","))
    .join("\n");

  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
