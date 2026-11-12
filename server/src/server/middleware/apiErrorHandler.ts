import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
export function apiErrorHandler(err: unknown, _req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);
  if (err instanceof MulterError) {
    return res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ message:
      err.code === "LIMIT_FILE_SIZE" ? "This file exceeds the upload size limit." : "Upload one file and one output format per request." });
  }
  if (err && typeof err === "object" && "status" in err && typeof err.status === "number" && err.status >= 400 && err.status < 500 || err && typeof err === "object" && "status" in err && err.status === 503) {
    return res.status((err as { status: number }).status).json({ message: err instanceof Error ? err.message : "Request failed." });
  }
  console.error(err);
  return res.status(500).json({ message: "Something went wrong. Please try again." });
}
