import { NextResponse } from "next/server";
const globals = globalThis as typeof globalThis & {
  folioLimits?: Map<string, { count: number; reset: number }>;
};
const buckets = (globals.folioLimits ??= new Map<
  string,
  { count: number; reset: number }
>());
export function limit(request: Request, kind: "api" | "upload" = "api") {
  // scripts/start.mjs overwrites this header using the verified socket/proxy address.
  const client = request.headers.get("x-folio-client-ip") || "development";
  const key = kind + ":" + client;
  const now = Date.now();
  for (const [k, bucket] of buckets) if (bucket.reset <= now) buckets.delete(k);
  const bucket = buckets.get(key) || {
    count: 0,
    reset: now + (kind === "upload" ? 900000 : 60000),
  };
  if (!buckets.has(key) && buckets.size >= 10000)
    throw Object.assign(new Error("The converter is busy. Try again later."), {
      status: 503,
    });
  bucket.count++;
  buckets.set(key, bucket);
  if (bucket.count > (kind === "upload" ? 30 : 1200))
    throw Object.assign(
      new Error("Too many requests. Please try again later."),
      { status: 429, retryAfter: Math.ceil((bucket.reset - now) / 1000) },
    );
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function apiError(err: unknown) {
  const info = err as {
    status?: number;
    message?: string;
    retryAfter?: number;
  };
  const status =
    info?.status && info.status >= 400 && info.status <= 503
      ? info.status
      : 500;
  if (status === 500) console.error("API error", err);
  const response = json(
    {
      message:
        status === 500
          ? "Something went wrong. Please try again."
          : info.message || "Request failed.",
    },
    status,
  );
  if (info?.retryAfter)
    response.headers.set("Retry-After", String(info.retryAfter));
  return response;
}
