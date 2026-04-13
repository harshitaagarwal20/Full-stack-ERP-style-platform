export function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      const error = new Error("Unauthorized");
      error.statusCode = 401;
      return next(error);
    }

    if (req.user.role === "admin") {
      return next();
    }

    if (!roles.includes(req.user.role)) {
      const error = new Error("Forbidden for this role.");
      error.statusCode = 403;
      return next(error);
    }

    return next();
  };
}
