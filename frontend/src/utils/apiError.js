function getApiErrorMessage(error, fallback = "Something went wrong.") {
  return error?.response?.data?.message || error?.message || fallback;
}

export function logApiError(error, fallback = "Something went wrong.") {
  const message = getApiErrorMessage(error, fallback);
  if (typeof window !== "undefined" && typeof window.alert === "function") {
    window.alert(message);
  }
  console.error(message);
  return message;
}
