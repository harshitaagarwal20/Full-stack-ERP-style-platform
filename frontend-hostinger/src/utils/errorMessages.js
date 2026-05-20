function extractValidationMessages(errors) {
  if (!errors || typeof errors !== "object") return [];

  return Object.values(errors)
    .flat()
    .map((message) => String(message || "").trim())
    .filter(Boolean);
}

export function getValidationFieldErrors(error) {
  const rawErrors = error?.response?.data?.errors;
  if (!rawErrors || typeof rawErrors !== "object") return {};

  return Object.entries(rawErrors).reduce((acc, [field, messages]) => {
    const fieldMessages = Array.isArray(messages) ? messages : [messages];
    const normalized = fieldMessages.map((message) => String(message || "").trim()).filter(Boolean);
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
