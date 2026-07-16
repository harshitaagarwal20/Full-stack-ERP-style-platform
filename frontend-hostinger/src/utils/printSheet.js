// Printing a sheet that lives inside the app shell.
//
// The obvious approach — hide everything with `visibility: hidden` and show the
// sheet again — is unreliable: hidden elements keep their layout box, so the app
// still pushes the sheet down the page and pads the output with blank sheets,
// and any ancestor with overflow/height clipping can swallow it outright.
//
// So instead the sheet is lifted out: cloned into a container that is a direct
// child of <body>, with everything else display:none'd for the duration. A clone
// carries no live form state (cloneNode copies attributes, not the value
// property), so current values are written into the markup first — otherwise a
// filled-in sheet would print blank.
const CONTAINER_ID = "print-container";

function freezeFormValues(source, clone) {
  const sourceFields = source.querySelectorAll("input, textarea, select");
  const cloneFields = clone.querySelectorAll("input, textarea, select");

  sourceFields.forEach((field, index) => {
    const target = cloneFields[index];
    if (!target) return;

    if (field.tagName === "SELECT") {
      const selected = field.options[field.selectedIndex];
      // Render the chosen option as text — a <select> prints as a control,
      // and an empty one prints as an empty box.
      const span = document.createElement("span");
      span.className = "print-field-value";
      span.textContent = selected ? selected.text : "";
      target.replaceWith(span);
      return;
    }

    if (field.type === "checkbox" || field.type === "radio") {
      if (field.checked) target.setAttribute("checked", "checked");
      else target.removeAttribute("checked");
      return;
    }

    if (field.tagName === "TEXTAREA") {
      target.textContent = field.value;
      return;
    }

    target.setAttribute("value", field.value);
  });
}

function cleanUp() {
  document.body.classList.remove("is-printing");
  document.getElementById(CONTAINER_ID)?.remove();
}

// `selector` names the element to print; it defaults to whatever is currently
// marked as the print root (the open modal, or the sheet on the page).
export function printSheet(selector = ".print-root") {
  const source = document.querySelector(selector);
  if (!source) return;

  cleanUp();

  const container = document.createElement("div");
  container.id = CONTAINER_ID;

  const clone = source.cloneNode(true);
  clone.classList.add("print-clone");
  freezeFormValues(source, clone);
  container.appendChild(clone);
  document.body.appendChild(container);
  document.body.classList.add("is-printing");

  // Cleanup happens on `afterprint` and nothing else — no timer, no focus
  // backstop. Chrome does not reliably block on window.print(): the preview
  // renders asynchronously, so anything that tears the container down early
  // (a timeout, a stray focus event) empties the page mid-render and the sheet
  // prints blank. Both were tried; both did exactly that.
  //
  // If a browser never fires `afterprint`, the leftover container is harmless:
  // it is display:none on screen, and the next printSheet() call clears it.
  const done = () => {
    window.removeEventListener("afterprint", done);
    cleanUp();
  };
  window.addEventListener("afterprint", done);

  window.print();
}

export default printSheet;
