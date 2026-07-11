import { cleanupAuditLogRetention } from "../services/auditService.js";

// This endpoint runs a destructive DELETE (audit-log retention purge) and has
// no user auth in front of it, so it must authenticate the caller itself — in
// EVERY environment. Authorization is a shared secret (CRON_SECRET) supplied
// by the scheduler via `x-cron-secret` or `Authorization: Bearer`. With no
// CRON_SECRET configured, or a missing/incorrect secret, the request is
// rejected.
function isCronRequestAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.authorization || "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const provided = req.headers["x-cron-secret"] || bearer;
  return typeof provided === "string" && provided.length > 0 && provided === cronSecret;
}

export async function runAuditRetentionJob(req, res, next) {
  try {
    if (!isCronRequestAuthorized(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await cleanupAuditLogRetention();
    return res.json({
      ok: true,
      ...result
    });
  } catch (error) {
    return next(error);
  }
}
