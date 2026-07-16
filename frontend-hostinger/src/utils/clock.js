// "Now", in the shapes <input type="date"> and <input type="time"> expect.
// Test sheets are filled in as the sample is drawn, so a fresh row opens on the
// current date and clock time rather than making the operator retype what they
// are standing in. Both remain editable for readings written up after the fact.
export function nowDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function nowTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}
