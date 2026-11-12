import path from "node:path";
import { fileURLToPath } from "node:url";
function integer(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
export const config = {
  dataDir: path.resolve(process.env.DATA_DIR || fileURLToPath(new URL("../data", import.meta.url))),
  maxUploadBytes: integer("MAX_UPLOAD_MB", 25, 1, 100) * 1024 * 1024,
  concurrency: integer("CONVERSION_CONCURRENCY", 2, 1, 4),
  maxPending: integer("MAX_PENDING_JOBS", 20, 1, 100),
  timeoutMs: integer("CONVERSION_TIMEOUT_SECONDS", 120, 5, 600) * 1000,
  retentionMs: integer("FILE_RETENTION_HOURS", 1, 1, 24) * 3600000,
  maxStoredJobs: integer("MAX_STORED_JOBS", 200, 1, 2000)
};
