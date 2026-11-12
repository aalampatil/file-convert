import fs from "node:fs/promises";
import { initialize } from "@/server/services/runtime";
import { createJob, reserveUpload } from "@/server/services/jobs";
import { publicJob } from "@/server/services/jobTypes";
import {
  assertConversion,
  officeAvailable,
} from "@/server/services/supportedFormats";
import { receiveUpload } from "@/server/upload";
import { apiError, json, limit } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  let release: (() => void) | undefined;
  let uploadPath: string | undefined;
  let accepted = false;
  try {
    limit(request);
    limit(request, "upload");
    await initialize();
    const origin = request.headers.get("origin");
    if (origin && new URL(origin).host !== request.headers.get("host"))
      throw Object.assign(new Error("This upload origin is not allowed."), {
        status: 403,
      });
    release = reserveUpload();
    const upload = await receiveUpload(request);
    uploadPath = upload.uploadPath;
    assertConversion(upload.originalName, upload.targetFormat);
    if (/\.docx?$/i.test(upload.originalName) && !(await officeAvailable())) {
      throw Object.assign(
        new Error(
          "Word conversion is unavailable on this server. LibreOffice must be installed.",
        ),
        { status: 503 },
      );
    }
    const job = await createJob(upload);
    accepted = true;
    return json(publicJob(job), 201);
  } catch (err) {
    return apiError(err);
  } finally {
    release?.();
    if (!accepted && uploadPath)
      await fs
        .rm(uploadPath, { force: true })
        .catch((err) => console.error("Upload cleanup failed", err));
  }
}
