import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env.js";
import { errorMiddleware, notFoundMiddleware } from "./middleware/errorMiddleware.js";
import authRoutes from "./routes/authRoutes.js";
import auditRoutes from "./routes/auditRoutes.js";
import dispatchRoutes from "./routes/dispatchRoutes.js";
import enquiryRoutes from "./routes/enquiryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import productionRoutes from "./routes/productionRoutes.js";
import userRoutes from "./routes/userRoutes.js";

const app = express();
const allowedOrigins = new Set(String(env.clientOrigin || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.size === 0 || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("CORS blocked for this origin."));
    },
    credentials: true
  })
);
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "FMS API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/production", productionRoutes);
app.use("/api/dispatch", dispatchRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
