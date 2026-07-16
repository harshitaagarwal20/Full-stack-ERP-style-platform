function getDefaultConfiguredUrl() {
  if (typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env.VITE_API_URL === "string") {
    return import.meta.env.VITE_API_URL;
  }

  return undefined;
}

export function resolveApiBaseUrl({
  configuredUrl = getDefaultConfiguredUrl(),
  hostname = typeof window !== "undefined" ? window.location.hostname : ""
} = {}) {
  const value = String(configuredUrl || "").trim();

  // The backend is served from the same origin as the frontend, so an unset
  // VITE_API_URL falls back to the relative /api path.
  return value || "/api";
}
