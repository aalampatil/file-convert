import type http from "node:http";
import { Server } from "socket.io";

import { jobEvents } from "../services/jobEvents.js";

export function createSocketServer(httpServer: http.Server) {
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  const io = new Server(httpServer, {
    cors: { origin: clientOrigin, credentials: true }
  });

  io.on("connection", (socket) => {
    socket.on("jobs:subscribe", ({ jobId }: { jobId: string }) => {
      socket.join(`job:${jobId}`);
    });
  });

  jobEvents.on("job:update", (evt) => {
    io.to(`job:${evt.jobId}`).emit("job:update", evt);
  });
}

