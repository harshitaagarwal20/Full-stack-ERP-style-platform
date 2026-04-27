import { getDashboardSummary } from "../services/dashboardService.js";

export async function getDashboard(req, res, next) {
  try {
    const summary = await getDashboardSummary();
    res.setHeader("Cache-Control", "private, max-age=10");
    return res.json(summary);
  } catch (error) {
    return next(error);
  }
}
