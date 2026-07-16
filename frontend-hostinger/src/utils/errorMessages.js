const VALIDATION_FIELD_LABELS = {
  address: "Address",
  city: "City",
  client_name: "Client name",
  company_name: "Company name",
  country: "Country",
  country_code: "Country code",
  current_password: "Current password",
  customer_code: "Customer code",
  customer_name: "Customer name",
  delivery_date: "Expected timeline",
  dispatch_date: "Dispatch date",
  direction: "Direction",
  email: "Email",
  expected_timeline: "Expected timeline",
  grade: "Grade",
  item_id: "Item",
  name: "Name",
  new_password: "New password",
  packaging_requirement: "Packaging requirement",
  password: "Password",
  pincode: "Pincode",
  price: "Price",
  product: "Product",
  products: "Products requested",
  quantity: "Quantity",
  reason: "Reason",
  remarks: "Remarks",
  role: "Role",
  state: "State",
  supplier_code: "Supplier code",
  supplier_name: "Supplier name",
  unit: "Unit",
  unit_of_measurement: "Unit"
};

function formatFieldLabel(field) {
  const normalizedField = String(field || "")
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter((part) => part && !/^\d+$/.test(part))
    .pop();

  if (!normalizedField) return "This field";
  if (VALIDATION_FIELD_LABELS[normalizedField]) return VALIDATION_FIELD_LABELS[normalizedField];

  return normalizedField
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function prettifyValidationMessage(field, message) {
  const label = formatFieldLabel(field);
  const text = String(message || "").trim();
  if (!text) return `${label} is invalid.`;

  const minMatch = text.match(/String must contain at least (\d+) character\(s\)/i);
  if (minMatch) return `${label} must be at least ${minMatch[1]} characters.`;

  const maxMatch = text.match(/String must contain at most (\d+) character\(s\)/i);
  if (maxMatch) return `${label} must be at most ${maxMatch[1]} characters.`;

  const exactMatch = text.match(/String must contain exactly (\d+) character\(s\)/i);
  if (exactMatch) return `${label} must be exactly ${exactMatch[1]} characters.`;

  if (/^Required$/i.test(text)) return `${label} is required.`;
  if (/Invalid enum value/i.test(text)) return `Select a valid ${label.toLowerCase()}.`;
  if (/Expected number, received/i.test(text)) return `${label} must be a number.`;
  if (/Expected string, received/i.test(text)) return `${label} is required.`;

  return text;
}

function extractValidationMessages(errors) {
  if (!errors || typeof errors !== "object") return [];

  return Object.entries(errors)
    .flatMap(([field, messages]) => (Array.isArray(messages) ? messages : [messages])
      .map((message) => prettifyValidationMessage(field, message)))
    .filter(Boolean);
}

export function getValidationFieldErrors(error) {
  const rawErrors = error?.response?.data?.errors;
  if (!rawErrors || typeof rawErrors !== "object") return {};

  return Object.entries(rawErrors).reduce((acc, [field, messages]) => {
    const fieldMessages = Array.isArray(messages) ? messages : [messages];
    const normalized = fieldMessages.map((message) => prettifyValidationMessage(field, message)).filter(Boolean);
    if (normalized.length > 0) {
      acc[field] = normalized;
    }
    return acc;
  }, {});
}

function isTechnicalMessage(message) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("route not found") ||
    text.includes("internal server error") ||
    text.includes("request failed with status code") ||
    text.includes("prisma") ||
    text.includes("syntaxerror") ||
    text.includes("validation failed")
  );
}

export function getUserFacingErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const response = error?.response;
  const status = response?.status;
  const backendMessage = String(response?.data?.message || error?.message || "").trim();
  const validationMessages = extractValidationMessages(response?.data?.errors);

  if (!response) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "You appear to be offline. Check your internet connection and try again.";
    }

    // Axios aborts a request that overruns its timeout with this code — the
    // server is up but took too long, which is a different story from being
    // unreachable, so say so and let the user simply retry.
    if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message || "")) {
      return "The server took too long to respond. Please try again.";
    }

    return "We could not reach the server. Please try again in a moment.";
  }

  if (status === 401) {
    if (/invalid email or password/i.test(backendMessage)) {
      return backendMessage;
    }
    return "Your session expired. Please sign in again.";
  }

  if (status === 403) {
    return "You do not have permission to perform this action.";
  }

  if (status === 404) {
    return "The requested item could not be found.";
  }

  if (status === 409) {
    return backendMessage && !isTechnicalMessage(backendMessage)
      ? backendMessage
      : "This item already exists or has already been processed.";
  }

  if (status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (status === 503) {
    return "The service is temporarily unavailable. Please try again later.";
  }

  if (validationMessages.length > 0) {
    const preview = validationMessages.slice(0, 3).join(" ");
    return `Please check the highlighted fields. ${preview}`;
  }

  if (backendMessage && !isTechnicalMessage(backendMessage)) {
    return backendMessage;
  }

  return fallback;
}

export function dispatchUserMessage(message, { title = "Error", variant = "error" } = {}) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("fms-notification", {
      detail: {
        title,
        message,
        variant
      }
    })
  );
}
