import { cleanupAuditLogRetention } from "../services/auditService.js";

export async function runAuditRetentionJob(req, res, next) {
  try {
    if (process.env.NODE_ENV === "production" && req.headers["x-vercel-cron"] !== "1") {
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
