// Managed MySQL hosts (Aiven, PlanetScale, ...) only accept TLS connections and
// signal it with `?ssl-mode=REQUIRED` (or `ssl=true`) on the URL. The URL is
// parsed by hand for the driver, so that flag has to be mapped explicitly —
// otherwise the driver speaks plain TCP, the server drops it, and every query
// dies with "pool timeout ... active=0 idle=0". Plain URLs (Hostinger MySQL)
// carry no flag and are unaffected.
export function buildSslOption(url) {
  const mode = String(url.searchParams.get("ssl-mode") || url.searchParams.get("sslmode") || "").toUpperCase();
  const sslFlag = String(url.searchParams.get("ssl") || "").toLowerCase();

  if (mode.startsWith("VERIFY")) return { ssl: true };
  if (mode === "REQUIRED" || mode === "PREFERRED" || sslFlag === "true" || sslFlag === "1") {
    return { ssl: { rejectUnauthorized: false } };
  }
  return {};
}
