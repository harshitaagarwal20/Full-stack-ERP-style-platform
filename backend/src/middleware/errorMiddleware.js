export function notFoundMiddleware(req, res) {
  res.status(404).json({ message: "The requested resource could not be found." });
}

function getStatusCode(error) {
  if (typeof error?.statusCode === "number") return error.statusCode;
  if (typeof error?.status === "number") return error.status;

  // Prisma P5xxx/P6xxx are upstream data-proxy/availability errors (not raised
  // by the direct mariadb adapter, but mapped defensively): treat as a 503
  // rather than letting them fall through to an opaque 500.
  if (typeof error?.code === "string" && /^P[56]\d{3}$/.test(error.code)) {
    return 503;
  }

  switch (error?.code) {
    case "ER_ACCESS_DENIED_ERROR":
    case "ER_BAD_DB_ERROR":
    case "ENOTFOUND":
    case "ECONNREFUSED":
    case "ETIMEDOUT":
    case "PROTOCOL_CONNECTION_LOST":
      return 503;
    case "P1000":
    case "P1003":
    case "P1010":
      return 503;
    case "P2002":
    case "P2003":
      return 409;
    case "P2025":
      return 404;
    case "P2000":
    case "P2011":
      return 400;
    case "P2021":
    case "P2022":
      return 500;
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
  if (error?.code === "ER_ACCESS_DENIED_ERROR" || error?.code === "P1000") {
    return "Database login failed. Check the MySQL username and password in DATABASE_URL.";
  }
  if (error?.code === "ER_BAD_DB_ERROR" || error?.code === "P1003") {
    return "Database name was not found. Check the database name in DATABASE_URL.";
  }
  if (error?.code === "ENOTFOUND") return "Database host was not found. Check the host in DATABASE_URL.";
  if (error?.code === "ECONNREFUSED" || error?.code === "ETIMEDOUT" || error?.code === "PROTOCOL_CONNECTION_LOST") {
    return "Database connection failed. Check Hostinger MySQL host, port, and remote access settings.";
  }
  if (error?.code === "P1010") return "Database user does not have permission to access this database.";
  if (error?.code === "P2002") return "A record with this value already exists.";
  if (error?.code === "P2003") return "A related record is missing.";
  if (error?.code === "P2025") return "Requested record not found.";
  if (error?.code === "P2000") return "One or more values are too long for the database field.";
  if (error?.code === "P2011") return "A required field is missing.";
  if (error?.code === "P2021" || error?.code === "P2022") {
    return "Database schema is missing a required table or column. Run the latest SQL migration on Hostinger.";
  }
  if (
    error?.code === "P1001" ||
    error?.code === "P1002" ||
    error?.code === "P1008" ||
    error?.code === "P1000" ||
    error?.code === "P1003" ||
    error?.code === "P1010" ||
    error?.code === "P1017" ||
    error?.name === "PrismaClientInitializationError" ||
    error?.name === "PrismaClientRustPanicError"
  ) {
    return "Database connection is temporarily unavailable.";
  }
  if (typeof error?.code === "string" && /^P[56]\d{3}$/.test(error.code)) {
    return "Database service is temporarily unavailable. Please try again.";
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
