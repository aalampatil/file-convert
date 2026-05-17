import path from "node:path";
import fs from "node:fs/promises";
import { nanoid } from "nanoid";

import { jobEvents } from "./jobEvents.js";
import type { JobRecord } from "./jobTypes.js";
import { ensureDirs, outputsDir } from "./storage.js";
import { putJob, getJobFromStore, updateJob } from "./jobStore.js";
import { convertFile } from "./converters/convertFile.js";

export async function createJob(input: { originalName: string; uploadPath: string; targetFormat: string }) {
  await ensureDirs();
  const id = nanoid();

  const job: JobRecord = {
    id,
    createdAt: new Date().toISOString(),
    originalName: input.originalName,
    uploadPath: input.uploadPath,
    targetFormat: input.targetFormat.toLowerCase(),
    status: "queued",
    progress: 0
  };

  await putJob(job);
  jobEvents.emit("job:update", { jobId: id, status: job.status, progress: job.progress });

  queueJob(job).catch((e) => {
    updateJob(id, { status: "failed", progress: 100, message: (e as Error).message });
    jobEvents.emit("job:update", { jobId: id, status: "failed", progress: 100, message: (e as Error).message });
  });

  return job;
}

export async function getJob(jobId: string) {
  return getJobFromStore(jobId);
}

export async function getJobDownloadPath(jobId: string) {
  const job = await getJobFromStore(jobId);
  if (!job?.result) return null;
  return { absPath: job.result.outputPath, downloadName: job.result.outputName };
}

async function queueJob(job: JobRecord) {
  await updateAndEmit(job.id, { status: "processing", progress: 1, message: "Starting conversion…" });

  const baseName = path.parse(job.originalName).name;
  const outName = `${baseName}.${job.targetFormat || "out"}`;
  const outPath = path.join(outputsDir(), `${job.id}__${outName}`);

  const { outputPath, conversion } = await convertFile({
    inputPath: job.uploadPath,
    outputPath: outPath,
    targetFormat: job.targetFormat,
    onProgress: async (p) => {
      await updateAndEmit(job.id, { progress: p });
    }
  });

  // Ensure output exists before marking complete.
  await fs.stat(outputPath);

  await updateAndEmit(job.id, {
    status: "finished",
    progress: 100,
    message: "Done",
    result: { outputPath, outputName: outName, conversion }
  });
}

async function updateAndEmit(jobId: string, patch: Partial<JobRecord>) {
  const next = await updateJob(jobId, patch);
  if (!next) return;
  jobEvents.emit("job:update", {
    jobId,
    status: next.status,
    progress: next.progress,
    message: next.message
  });
}
