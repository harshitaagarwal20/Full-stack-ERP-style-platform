import axios from "axios";
import { resolveApiBaseUrl } from "./apiBaseUrl";

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

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures and continue with the in-memory session state.
  }
}

// Without a timeout, axios waits on a slow or unreachable backend indefinitely —
// the page just spins with no error, which is what made loading feel infinite
// rather than failed. 30s is comfortably above any normal request here (the
// data volumes are small) while still failing a genuinely stuck one fast enough
// to show a message and let the user retry.
const REQUEST_TIMEOUT_MS = 30000;

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: REQUEST_TIMEOUT_MS
});

api.interceptors.request.use((config) => {
  const token = safeGetItem("fms_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    // The backend rolls the session forward for an active user: whenever it
    // sends a freshly minted token, adopt it so the login never lapses while
    // the app is in use.
    const renewed = response?.headers?.["x-renewed-token"];
    if (renewed) {
      safeSetItem("fms_token", renewed);
    }
    return response;
  },
  (error) => {
    const isLoginRequest = String(error?.config?.url || "").includes("/auth/login");
    if (error?.response?.status === 401 && !isLoginRequest) {
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
