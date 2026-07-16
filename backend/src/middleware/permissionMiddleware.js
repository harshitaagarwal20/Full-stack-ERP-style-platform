import { levelFromMethod, satisfies } from "../config/permissions.js";
import { getLevelFor } from "../services/permissionService.js";

// Gates a route on the admin-configured module access. The required level is
// derived from the HTTP method: reads need VIEW, writes need FULL.
//
// Pass an explicit level for the rare route whose method doesn't reflect its
// intent — e.g. a POST that only runs a report.
export function requirePermission(moduleKey, explicitLevel = null) {
  return async (req, res, next) => {
    if (!req.user) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      return next(error);
    }

    // Admin is never gated — otherwise a bad edit on the permissions screen
    // could lock every admin out of the permissions screen.
    if (req.user.role === "admin") return next();

    try {
      const required = explicitLevel || levelFromMethod(req.method);
      const level = await getLevelFor(req.user.role, moduleKey);

      if (!satisfies(level, required)) {
        const error = new Error("Forbidden for this role.");
        error.statusCode = 403;
        return next(error);
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
