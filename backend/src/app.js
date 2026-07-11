import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import cronRoutes from "./routes/cronRoutes.js";
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
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error("CORS blocked for this origin."));
    },
    credentials: true
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

app.get("/", (req, res) => {
  res.json({
    message:
      "Nimbasia backend is running. Production frontend: https://app.nimbasia.com. Health check: /api/health. Local dev frontend: http://localhost:5174."
  });
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

app.use("/api/auth", authRoutes);
app.use("/api/master-data", masterDataRoutes);
app.use("/api/diagnostics", diagnosticsRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/cron", cronRoutes);
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

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
