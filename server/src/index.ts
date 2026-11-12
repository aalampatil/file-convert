import "dotenv/config";
import http from "node:http";
import { createApp } from "./server/app.js";
import { loadJobs } from "./services/jobStore.js";
import { cleanupExpired, stopJobs } from "./services/jobs.js";
await loadJobs();
await cleanupExpired();
const { app } = createApp();
const server = http.createServer(app);
server.requestTimeout = 120_000;
server.headersTimeout = 30_000;
const cleanup = setInterval(() => cleanupExpired().catch(err => console.error("File cleanup failed", err)), 60_000);
cleanup.unref();
server.listen(Number(process.env.PORT || 5175), "0.0.0.0", () => console.log(`Folio listening on port ${process.env.PORT || 5175}`));
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(cleanup);
  const forced = setTimeout(() => process.exit(1), 20_000);
  forced.unref();
  server.close();
  await stopJobs();
  server.closeAllConnections();
  clearTimeout(forced);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
