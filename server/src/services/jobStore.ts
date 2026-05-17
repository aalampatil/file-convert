import type { JobRecord } from "./jobTypes.js";
import { mongoState } from "../server/mongoState.js";
import { JobModel } from "./models/JobModel.js";

const memoryJobs = new Map<string, JobRecord>();

export async function putJob(job: JobRecord) {
  memoryJobs.set(job.id, job);
  if (mongoState.enabled) await JobModel.updateOne({ id: job.id }, job, { upsert: true });
}

export async function getJobFromStore(jobId: string) {
  const mem = memoryJobs.get(jobId);
  if (mem) return mem;
  if (!mongoState.enabled) return null;
  const doc = await JobModel.findOne({ id: jobId }).lean<JobRecord>().exec();
  if (!doc) return null;
  memoryJobs.set(jobId, doc);
  return doc;
}

export async function updateJob(jobId: string, patch: Partial<JobRecord>) {
  const existing = await getJobFromStore(jobId);
  if (!existing) return null;
  const next = { ...existing, ...patch };
  memoryJobs.set(jobId, next);
  if (mongoState.enabled) await JobModel.updateOne({ id: jobId }, next, { upsert: true });
  return next;
}

