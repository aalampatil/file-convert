import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { config } from "../../config.js";
import { ensureDirs, uploadsDir } from "../../services/storage.js";
import { createJob, getJob, getJobDownloadPath, reserveUpload } from "../../services/jobs.js";
import { publicJob } from "../../services/jobTypes.js";
import { assertConversion, conversionGroups, officeAvailable } from "../../services/supportedFormats.js";
export const jobsRouter = Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { ensureDirs().then(() => cb(null, uploadsDir()), err => cb(err, "")); },
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (!conversionGroups.some(g => g.inputs.includes(ext))) return cb(Object.assign(new Error("This file type is not supported."), { status: 415 }));
    cb(null, true);
  },
  limits: { fileSize: config.maxUploadBytes, files: 1, fields: 1, parts: 2, fieldSize: 32, fieldNameSize: 32 }
}).single("file");
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Too many uploads. Please try again in 15 minutes." } });
jobsRouter.post("/", limiter, async (req, res, next) => {
  let release: (() => void) | undefined;
  let accepted = false;
  try {
    release = reserveUpload();
    await new Promise<void>((resolve, reject) => upload(req, res, err => err ? reject(err) : resolve()));
    if (!req.file) throw Object.assign(new Error("Choose a file to convert."), { status: 400 });
    if (!req.file.size) throw Object.assign(new Error("The file is empty."), { status: 400 });
    const target = typeof req.body.targetFormat === "string" ? req.body.targetFormat.toLowerCase().trim() : "";
    if (!/^[a-z0-9]{2,8}$/.test(target)) throw Object.assign(new Error("Choose a valid output format."), { status: 400 });
    assertConversion(req.file.originalname, target);
    if (/\.docx?$/i.test(req.file.originalname) && !await officeAvailable()) {
      throw Object.assign(new Error("Word conversion is unavailable on this server. LibreOffice must be installed."), { status: 503 });
    }
    const name = path.basename(req.file.originalname.replace(/\\/g, "/")).replace(/[\x00-\x1f\x7f]/g, "").slice(0, 180) || "document";
    const job = await createJob({ originalName: name, uploadPath: req.file.path, targetFormat: target });
    accepted = true;
    res.status(201).json(publicJob(job));
  } catch (err) { next(err); }
  finally {
    release?.();
    if (!accepted && req.file) await fs.rm(req.file.path, { force: true }).catch(err => console.error("Upload cleanup failed", err));
  }
});
jobsRouter.get("/:jobId", async (req, res, next) => {
  try {
    const job = await getJob(req.params.jobId);
    if (!job) return res.status(404).json({ message: "This conversion was not found or has expired." });
    res.json(publicJob(job));
  } catch (err) { next(err); }
});
jobsRouter.get("/:jobId/download", async (req, res, next) => {
  try {
    const download = await getJobDownloadPath(req.params.jobId);
    if (!download) return res.status(404).json({ message: "This download is not ready or has expired." });
    res.download(download.absPath, download.downloadName, err => { if (err) next(err); });
  } catch (err) { next(err); }
});
