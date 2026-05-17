import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { createApp } from "./server/app.js";
import { initMongo } from "./server/mongo.js";
import { createSocketServer } from "./server/socket.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const port = Number(process.env.PORT || 5175);

const { app } = createApp();
const httpServer = http.createServer(app);
createSocketServer(httpServer);

await initMongo();

httpServer.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${port}`);
});

