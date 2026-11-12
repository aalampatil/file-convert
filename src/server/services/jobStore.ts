import fs from "node:fs/promises";
import path from "node:path";
import type { JobRecord } from "./jobTypes.ts";
import { ensureDirs, recordsDir } from "./storage.ts";
const globals = globalThis as typeof globalThis & { folioRecords?: Map<string, JobRecord> };
const memoryJobs = globals.folioRecords ??= new Map<string, JobRecord>();
export function allJobs() { return [...memoryJobs.values()]; }
export async function putJob(job: JobRecord) {
  const target = path.join(recordsDir(), `${job.id}.json`);
  await fs.writeFile(`${target}.tmp`, JSON.stringify(job), { mode: 0o600 });
  await fs.rename(`${target}.tmp`, target);
  memoryJobs.set(job.id, job);
}
export async function getJobFromStore(id: string) { return memoryJobs.get(id) ?? null; }
export async function updateJob(id: string, patch: Partial<JobRecord>) {
  const job = memoryJobs.get(id);
  if (!job) return null;
  const next = { ...job, ...patch };
  await putJob(next);
  return next;
}
export async function deleteJob(id: string) {
  await fs.rm(path.join(recordsDir(), `${id}.json`), { force: true });
  memoryJobs.delete(id);
}
export async function loadJobs() {
  await ensureDirs();
  for (const name of await fs.readdir(recordsDir())) {
    if (!/^[\w-]+\.json$/.test(name)) continue;
    try {
      const job = JSON.parse(await fs.readFile(path.join(recordsDir(), name), "utf8")) as JobRecord;
      if (!job.id || `${job.id}.json` !== name) continue;
      memoryJobs.set(job.id, job);
      if (job.status === "queued" || job.status === "processing") {
        await updateJob(job.id, { status: "failed", progress: 100, message: "The server restarted during conversion. Please try again." });
      }
    } catch (err) { console.error(`Could not restore job record ${name}`, err); }
  }
}
