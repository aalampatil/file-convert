import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function apiErrorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "validation_error", details: err.flatten() });
  }

  if (err && typeof err === "object" && "status" in err && typeof (err as any).status === "number") {
    const status = (err as any).status as number;
    const message = (err as any).message ?? "request_failed";
    return res.status(status).json({ error: "request_failed", message });
  }

  // eslint-disable-next-line no-console
  console.error(err);
  return res.status(500).json({ error: "internal_error" });
}

