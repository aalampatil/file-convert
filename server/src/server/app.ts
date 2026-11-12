import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rateLimit } from "express-rate-limit";
import { jobsRouter } from "./routes/jobs.js";
import { formatsRouter } from "./routes/formats.js";
import { apiErrorHandler } from "./middleware/apiErrorHandler.js";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY_HOPS) {
    const hops = Number(process.env.TRUST_PROXY_HOPS);
    if (!Number.isInteger(hops) || hops < 1 || hops > 5) throw new Error("Invalid TRUST_PROXY_HOPS");
    app.set("trust proxy", hops);
  }
  app.use(helmet({ contentSecurityPolicy: { directives: { "upgrade-insecure-requests": process.env.NODE_ENV === "production" ? [] : null } } }));
  if (process.env.CLIENT_ORIGIN) app.use(cors({ origin: process.env.CLIENT_ORIGIN, methods: ["GET", "POST"] }));
  app.get("/healthz", (_req, res) => res.json({ ok: true }));
  app.use("/api", (_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  app.use("/api", rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false,
    message: { message: "Too many requests. Please wait a minute." } }));
  app.use("/api/formats", formatsRouter);
  app.use("/api/jobs", jobsRouter);
  app.use("/api", (_req, res) => res.status(404).json({ message: "Endpoint not found." }));
  const clientDir = fileURLToPath(new URL("../../../client/dist/", import.meta.url));
  app.use(express.static(clientDir, { index: "index.html" }));
  app.get("*", (_req, res, next) => res.sendFile(path.join(clientDir, "index.html"), err => { if (err) next(err); }));
  app.use(apiErrorHandler);
  return { app };
}
