import http from "node:http";
import next from "next";
const app = next({ dev: false });
await app.prepare();
// Next loads .env.local during prepare; import worker configuration afterward.
const { initialize, stopCleanup } =
  await import("../.worker/services/runtime.js");
const { stopJobs } = await import("../.worker/services/jobs.js");
await initialize();
const handler = app.getRequestHandler();
const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isInteger(hops) || hops < 0 || hops > 5)
  throw new Error("Invalid TRUST_PROXY_HOPS");
const server = http.createServer((req, res) => {
  const remote = req.socket.remoteAddress || "unknown";
  const forwarded =
    typeof req.headers["x-forwarded-for"] === "string"
      ? req.headers["x-forwarded-for"].split(",").map((ip) => ip.trim())
      : [];
  const chain = [...forwarded, remote];
  req.headers["x-folio-client-ip"] =
    chain[Math.max(0, chain.length - 1 - hops)];
  handler(req, res);
});
server.requestTimeout = 120000;
server.headersTimeout = 30000;
server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
  console.log(`Folio ready on port ${process.env.PORT || 3000}`),
);
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  stopCleanup();
  const force = setTimeout(() => process.exit(1), 20000);
  force.unref();
  server.close();
  await stopJobs();
  server.closeAllConnections();
  await app.close();
  clearTimeout(force);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
