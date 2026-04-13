import { listAuditLogs } from "../services/auditService.js";

export async function getAuditLogs(req, res, next) {
  try {
    const logs = await listAuditLogs(req.query);
    return res.json(logs);
  } catch (error) {
    return next(error);
  }
}
