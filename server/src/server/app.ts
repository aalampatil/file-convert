import express from "express";
import cors from "cors";

import { jobsRouter } from "./routes/jobs.js";
import { formatsRouter } from "./routes/formats.js";
import { apiErrorHandler } from "./middleware/apiErrorHandler.js";

export function createApp() {
  const app = express();

  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";
  app.use(cors({ origin: clientOrigin, credentials: true }));

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  app.use("/api/formats", formatsRouter);
  app.use("/api/jobs", jobsRouter);
  app.use(apiErrorHandler);

  return { app };
}

