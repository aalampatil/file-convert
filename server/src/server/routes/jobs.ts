import { Router } from "express";
import multer from "multer";
import path from "node:path";

import { z } from "zod";

import { ensureDirs, uploadsDir } from "../../services/storage.js";
import { createJob, getJob, getJobDownloadPath } from "../../services/jobs.js";

export const jobsRouter = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureDirs();
        cb(null, uploadsDir());
      } catch (e) {
        cb(e as Error, uploadsDir());
      }
    },
    filename: (_req, file, cb) => {
      const safeBase = path.basename(file.originalname).replace(/[^\w.\-()+ ]+/g, "_");
      cb(null, `${Date.now()}__${safeBase}`);
    }
  }),
  limits: { fileSize: 1024 * 1024 * 200 } // 200MB
});

const createJobSchema = z.object({
  targetFormat: z.string().trim().min(1).max(16)
});

jobsRouter.post("/", upload.single("file"), async (req, res) => {
  const parsed = createJobSchema.parse(req.body);
  if (!req.file) return res.status(400).json({ error: "missing_file" });

  const job = await createJob({
    originalName: req.file.originalname,
    uploadPath: req.file.path,
    targetFormat: parsed.targetFormat
  });

  res.status(201).json(job);
});

jobsRouter.get("/:jobId", async (req, res) => {
  const job = await getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "not_found" });
  res.json(job);
});

jobsRouter.get("/:jobId/download", async (req, res) => {
  const download = await getJobDownloadPath(req.params.jobId);
  if (!download) return res.status(404).json({ error: "not_found" });

  const { absPath, downloadName } = download;
  res.download(absPath, downloadName);
});

