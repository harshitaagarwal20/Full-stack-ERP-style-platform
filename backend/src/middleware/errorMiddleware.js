export function notFoundMiddleware(req, res) {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
}

function getStatusCode(error) {
  if (typeof error?.statusCode === "number") return error.statusCode;
  if (typeof error?.status === "number") return error.status;

  switch (error?.code) {
    case "P2002":
    case "P2003":
      return 409;
    case "P2025":
      return 404;
    case "P2000":
    case "P2011":
      return 400;
    default:
      return 500;
  }
}

function getMessage(error) {
  if (error?.details) return error.message || "Validation failed";
  if (error?.code === "P2002") return "A record with this value already exists.";
  if (error?.code === "P2003") return "A related record is missing.";
  if (error?.code === "P2025") return "Requested record not found.";
  if (error?.code === "P2000") return "One or more values are too long for the database field.";
  if (error?.code === "P2011") return "A required field is missing.";
  if (error?.name === "SyntaxError" && String(error.message || "").includes("JSON")) {
    return "Invalid JSON payload.";
  }
  if (error?.name === "PrismaClientValidationError") return "Invalid data provided to the database.";
  return error?.message || "Internal server error";
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = getStatusCode(error);
  const payload = {
    message: getMessage(error)
  };

  if (error?.details) {
    payload.errors = error.details;
  }

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json(payload);
}
