const PRODUCTION_API_URL = "https://full-stack-erp-style-platform-4.onrender.com/api";
const LEGACY_API_URLS = new Set([
  "https://nimbasia.onrender.com/api",
  "https://nimbasia-backend.onrender.com/api"
]);

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

  if (String(hostname || "").endsWith("vercel.app")) {
    return PRODUCTION_API_URL;
  }

  if (value) {
    if (LEGACY_API_URLS.has(value)) {
      return PRODUCTION_API_URL;
    }

    return value;
  }

  return "/api";
}
