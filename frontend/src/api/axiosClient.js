import axios from "axios";

function resolveApiBaseUrl() {
  return import.meta.env.VITE_API_URL || "/api";
}

function safeGetItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures and continue with the in-memory session state.
  }
}

const api = axios.create({
  baseURL: resolveApiBaseUrl()
});

api.interceptors.request.use((config) => {
  const token = safeGetItem("fms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const message = error?.response?.data?.message || "Session expired. Please sign in again.";
      safeRemoveItem("fms_token");
      safeRemoveItem("fms_user");
      window.dispatchEvent(
        new CustomEvent("fms-auth-expired", {
          detail: { message }
        })
      );
    }

    return Promise.reject(error);
  }
);

export default api;
