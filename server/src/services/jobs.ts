import path from "node:path";
import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fork, type ChildProcess } from "node:child_process";
import { config } from "../config.js";
import type { JobRecord } from "./jobTypes.js";
import { ensureDirs, outputsDir, uploadsDir } from "./storage.js";
import { allJobs, deleteJob, putJob, getJobFromStore, updateJob } from "./jobStore.js";

const queue: JobRecord[] = [];
const workers = new Set<ChildProcess>();
const running = new Set<Promise<void>>();
let reservations = 0;
let stopping = false;
export function reserveUpload() {
  if (stopping) throw Object.assign(new Error("The server is restarting. Please try again shortly."), { status: 503 });
  if (queue.length + workers.size + reservations >= config.maxPending + config.concurrency || allJobs().length + reservations >= config.maxStoredJobs) {
    throw Object.assign(new Error("The converter is busy. Please try again later."), { status: 503 });
  }
  reservations++;
  let released = false;
  return () => { if (!released) { reservations--; released = true; } };
}
export async function createJob(input: { originalName: string; uploadPath: string; targetFormat: string }) {
  const job: JobRecord = { ...input, id: randomBytes(24).toString("base64url"),
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + config.retentionMs).toISOString(),
    status: "queued", progress: 0, message: "Waiting for a conversion slot" };
  await putJob(job);
  queue.push(job);
  pump();
  return job;
}
function pump() {
  while (!stopping && workers.size < config.concurrency && queue.length) {
    const job = queue.shift()!;
    // Reserve synchronously before starting async work.
    const workerUrl = new URL(`./converters/conversionWorker.${import.meta.url.endsWith(".ts") ? "ts" : "js"}`, import.meta.url);
    const worker = fork(workerUrl, [], {
      execArgv: [...(import.meta.url.endsWith(".ts") ? process.execArgv : []), "--max-old-space-size=384"],
      detached: process.platform !== "win32", windowsHide: true, stdio: ["ignore", "inherit", "inherit", "ipc"]
    });
    workers.add(worker);
    const task = processJob(job, worker).catch(err => console.error("Job persistence failed:", err)).finally(() => {
      workers.delete(worker); running.delete(task); pump();
    });
    running.add(task);
  }
}
function killWorker(worker: ChildProcess) {
  if (!worker.pid) return;
  try {
    if (process.platform === "win32") worker.kill("SIGKILL");
    else process.kill(-worker.pid, "SIGKILL");
  } catch { /* Worker may already have exited. */ }
}
async function processJob(job: JobRecord, worker: ChildProcess) {
  const dir = path.join(outputsDir(), job.id);
  const outName = `${path.parse(job.originalName).name}.${job.targetFormat}`;
  const outPath = path.join(dir, `result.${job.targetFormat}`);
  let updates = Promise.resolve();
  try {
    await fs.mkdir(dir, { recursive: true });
    await updateJob(job.id, { status: "processing", progress: 5, message: "Converting your file" });
    const result = await new Promise<NonNullable<JobRecord["result"]>>((resolve, reject) => {
      const timer = setTimeout(() => {
        killWorker(worker); reject(new Error("Conversion timed out. Try a smaller or simpler file."));
      }, config.timeoutMs);
      const finish = (error?: Error, value?: NonNullable<JobRecord["result"]>) => {
        clearTimeout(timer); error ? reject(error) : resolve(value!);
      };
      worker.on("message", (message: { progress?: number; error?: string; result?: { conversion: NonNullable<JobRecord["result"]>["conversion"] } }) => {
        if (message.progress !== undefined) {
          const progress = Math.max(5, Math.min(95, message.progress));
          updates = updates.then(async () => { await updateJob(job.id, { progress }); });
          updates.catch(() => {});
        }
        if (message.error) finish(new Error(message.error));
        if (message.result) finish(undefined, { outputPath: outPath, outputName: outName, conversion: message.result.conversion });
      });
      worker.once("error", error => finish(error));
      worker.once("exit", () => finish(new Error("The conversion worker stopped. Please try a smaller file.")));
      worker.send({ inputPath: job.uploadPath, outputPath: outPath, targetFormat: job.targetFormat }, err => { if (err) finish(err); });
    });
    await updates;
    const stat = await fs.stat(outPath);
    if (!stat.size) throw new Error("This conversion produced an empty document.");
    await updateJob(job.id, { status: "finished", progress: 100, message: job.targetFormat === "docx" ? "Ready. Review the exported layout before use." : "Ready to download", result });
  } catch (err) {
    await updates.catch(() => {});
    await updateJob(job.id, { status: "failed", progress: 100, message: (err as Error).message });
    await fs.rm(dir, { recursive: true, force: true });
  } finally {
    killWorker(worker);
    await fs.rm(job.uploadPath, { force: true });
  }
}
export async function getJob(id: string) {
  if (!/^[\w-]{32}$/.test(id)) return null;
  const job = await getJobFromStore(id);
  return job && Date.parse(job.expiresAt) > Date.now() ? job : null;
}
export async function getJobDownloadPath(id: string) {
  const job = await getJob(id);
  if (job?.status !== "finished" || !job.result) return null;
  return { absPath: job.result.outputPath, downloadName: job.result.outputName };
}
export async function cleanupExpired() {
  await ensureDirs();
  for (const job of allJobs()) {
    if (["processing", "queued"].includes(job.status) || Date.parse(job.expiresAt) > Date.now()) continue;
    await fs.rm(job.uploadPath, { force: true });
    await fs.rm(path.join(outputsDir(), job.id), { recursive: true, force: true });
    await deleteJob(job.id);
  }
  // Remove uploads abandoned by disconnected requests or interrupted processes.
  for (const name of await fs.readdir(uploadsDir())) {
    const file = path.join(uploadsDir(), name);
    const stat = await fs.stat(file);
    if (stat.isFile() && stat.mtimeMs < Date.now() - config.retentionMs) await fs.rm(file, { force: true });
  }
}
export async function stopJobs() {
  stopping = true;
  for (const job of queue.splice(0)) {
    await updateJob(job.id, { status: "failed", progress: 100, message: "The server is restarting. Please try again." });
    await fs.rm(job.uploadPath, { force: true });
  }
  const timer = setTimeout(() => workers.forEach(killWorker), 10_000);
  await Promise.allSettled([...running]);
  clearTimeout(timer);
}
