import compression from "compression";
import cors from "cors";
import express from "express";
import fs from "fs";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import env from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import roleRoutes from "./routes/roleRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import masterDataRoutes from "./routes/masterDataRoutes.js";
import diagnosticsRoutes from "./routes/diagnosticsRoutes.js";
import manualOrderRequestRoutes from "./routes/manualOrderRequestRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import bomRoutes from "./routes/bomRoutes.js";
import packingRoutes from "./routes/packingRoutes.js";
import grnRoutes from "./routes/grnRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import poRoutes from "./routes/poRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();

// Hostinger (and most PaaS hosts) run the app behind a reverse proxy that sets
// X-Forwarded-For. Trust the first proxy hop so req.ip is the real client and
// express-rate-limit can key on it instead of throwing a validation error.
app.set("trust proxy", 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../public");
const frontendIndexPath = path.join(publicDir, "index.html");

// No ETags on API responses. Express fingerprints every JSON body by default, so
// a repeat list request answers 304 with no body and the client re-renders from
// its cache. The data behind these endpoints changes constantly and the payloads
// are small, so always send the fresh body instead. This app serves no static
// assets, so nothing else here wants an ETag.
app.set("etag", false);

const allowedOriginRules = String(env.clientOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function wildcardRuleToRegExp(rule) {
  const escaped = rule
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");

  return new RegExp(`^${escaped}$`);
}

function isOriginAllowed(requestOrigin) {
  if (!requestOrigin) return true;
  if (allowedOriginRules.length === 0) return true;

  return allowedOriginRules.some((rule) => {
    if (rule === requestOrigin) return true;

    if (rule.includes("*")) {
      return wildcardRuleToRegExp(rule).test(requestOrigin);
    }

    return false;
  });
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Deny by returning `false` (not by throwing): the cors middleware then
      // simply omits the CORS headers and the browser blocks the response.
      // Throwing here surfaces as an unhandled 500 in errorMiddleware, which
      // masks a config problem as a server error and breaks even preflight.
      return callback(null, isOriginAllowed(origin));
    },
    credentials: true,
    // Let the browser read the rolling-session token the auth middleware hands
    // back, so an active user's session is refreshed without a re-login.
    exposedHeaders: ["X-Renewed-Token"]
  })
);
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    }
  })
);

// Belt and braces with the disabled ETag above: tell the browser (and any proxy
// in front of us) not to hold on to an API response at all.
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/api", (req, res) => {
  res.json({
    ok: true,
    message: "Nimbasia API is running. Use /api/health for health checks."
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "FMS API is running" });
});

app.get("/api/health/mysql", async (req, res, next) => {
  try {
    const { testMysqlConnection } = await import("./services/mysqlHealthService.js");
    const result = await testMysqlConnection();
    return res.json(result);
  } catch (error) {
    return next(error);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/master-data", masterDataRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/manual-orders", manualOrderRequestRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/purchase-orders", poRoutes);
app.use("/api/grns", grnRoutes);
app.use("/api/bom", bomRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/packing", packingRoutes);
app.use("/api/dispatch", dispatchRoutes);

app.use(express.static(publicDir));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  if (!fs.existsSync(frontendIndexPath)) return next();

  return res.sendFile(frontendIndexPath);
});

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
