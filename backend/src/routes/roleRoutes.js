import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { allowRoles } from "../middleware/roleMiddleware.js";
import { getPermissionSettings, getPermissionsForRole, updatePermissionMatrix } from "../services/permissionService.js";

const router = Router();
router.use(authMiddleware);

// Never let a permission response be cached. Express ETags JSON responses, so
// the browser's follow-up conditional request came back as a bodiless 304 —
// which left the Role Management grid rendering empty on every load after the
// first. Setting Cache-Control alone is not enough: Express still compares the
// ETag and answers 304, so the conditional headers are dropped here to force a
// full 200 with a body. These answers must reflect a grant or revoke the moment
// it happens anyway.
router.use((req, res, next) => {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  res.set("Cache-Control", "no-store");
  next();
});

// What the signed-in user can reach — drives the sidebar and route guards, so
// every authenticated role may read its own permissions.
router.get("/my-permissions", async (req, res, next) => {
  try {
    res.json({ role: req.user.role, permissions: await getPermissionsForRole(req.user.role) });
  } catch (error) {
    next(error);
  }
});

// The full editable matrix is admin-only.
router.get("/permissions", allowRoles(), async (req, res, next) => {
  try {
    res.json(await getPermissionSettings());
  } catch (error) {
    next(error);
  }
});

router.put("/permissions", allowRoles(), async (req, res, next) => {
  try {
    res.json(await updatePermissionMatrix(req.body?.matrix, req.user));
  } catch (error) {
    next(error);
  }
});

export default router;
