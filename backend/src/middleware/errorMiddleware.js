export function notFoundMiddleware(req, res) {
  res.status(404).json({ message: "The requested resource could not be found." });
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
    case "P1001":
    case "P1002":
    case "P1008":
    case "P1017":
      return 503;
    default:
      if (error?.name === "PrismaClientInitializationError") return 503;
      if (error?.name === "PrismaClientRustPanicError") return 503;
      return 500;
  }
}

function getMessage(error, status) {
  if (error?.details) return "Please review the highlighted fields.";
  if (error?.code === "P2002") return "A record with this value already exists.";
  if (error?.code === "P2003") return "A related record is missing.";
  if (error?.code === "P2025") return "Requested record not found.";
  if (error?.code === "P2000") return "One or more values are too long for the database field.";
  if (error?.code === "P2011") return "A required field is missing.";
  if (
    error?.code === "P1001" ||
    error?.code === "P1002" ||
    error?.code === "P1008" ||
    error?.code === "P1017" ||
    error?.name === "PrismaClientInitializationError" ||
    error?.name === "PrismaClientRustPanicError"
  ) {
    return "Database connection is temporarily unavailable.";
  }
  if (error?.name === "SyntaxError" && String(error.message || "").includes("JSON")) {
    return "Invalid JSON payload.";
  }
  if (error?.name === "PrismaClientValidationError") return "Invalid data provided to the database.";

  // Only trust the raw error message for errors app code deliberately threw
  // with a non-5xx status (e.g. `error.statusCode = 400`). Anything that
  // fell through to an unrecognized 5xx — a bug, a third-party library
  // exception — gets a generic message instead of leaking internal detail.
  if (status < 500) {
    const message = String(error?.message || "").trim();
    if (message && !message.toLowerCase().includes("route not found")) return message;
  }
  return "Something went wrong on the server.";
}

export function errorMiddleware(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = getStatusCode(error);
  const payload = {
    message: getMessage(error, status)
  };

  if (error?.details) {
    payload.errors = error.details;
  }

  if (status >= 500) {
    console.error(error);
  }

  return res.status(status).json(payload);
}
