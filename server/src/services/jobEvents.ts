import { EventEmitter } from "node:events";

export type JobUpdateEvent = {
  jobId: string;
  status: "queued" | "processing" | "finished" | "failed";
  progress: number;
  message?: string;
};

class JobEvents extends EventEmitter {}

export const jobEvents = new JobEvents();

