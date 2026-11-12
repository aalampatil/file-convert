import busboy from "busboy";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.ts";
import { ensureDirs, uploadsDir } from "./services/storage.ts";
import { conversionGroups } from "./services/supportedFormats.ts";

const invalid = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export async function receiveUpload(request: Request) {
  if (!request.body) throw invalid("Choose a file to convert.");
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data"))
    throw invalid("Send a multipart file upload.", 415);
  const maxBody = config.maxUploadBytes + 65536;
  if (Number(request.headers.get("content-length")) > maxBody)
    throw invalid("This file exceeds the upload size limit.", 413);
  await ensureDirs();
  const controller = new AbortController();
  const abort = () => controller.abort();
  request.signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 120000);
  let uploadPath = "",
    originalName = "",
    targetFormat = "",
    bytes = 0;
  let failure: Error | undefined;
  let write: Promise<void> | undefined;
  try {
    let parser: ReturnType<typeof busboy>;
    try {
      parser = busboy({
        headers: { "content-type": contentType },
        defParamCharset: "utf8",
        // Busboy emits partsLimit at the boundary after the final permitted part.
        // A limit of three allows our two parts; file/field limits still reject extras.
        limits: {
          fileSize: config.maxUploadBytes,
          files: 1,
          fields: 1,
          parts: 3,
          fieldSize: 32,
          fieldNameSize: 32,
        },
      });
    } catch {
      throw invalid("The upload boundary is invalid.");
    }
    parser.on("file", (field, stream, info) => {
      const ext = path.extname(info.filename || "").toLowerCase();
      if (
        field !== "file" ||
        !conversionGroups.some((g) => g.inputs.includes(ext.slice(1)))
      ) {
        failure = invalid("This file type is not supported.", 415);
        stream.resume();
        return;
      }
      const safeName = path
        .basename((info.filename || "document").replace(/\\/g, "/"))
        .replace(/[\x00-\x1f\x7f]/g, "");
      originalName =
        Array.from(path.parse(safeName).name)
          .slice(0, 160 - ext.length)
          .join("") + ext;
      uploadPath = path.join(uploadsDir(), randomUUID() + ext);
      stream.on("limit", () => {
        failure = invalid("This file exceeds the upload size limit.", 413);
      });
      write = pipeline(
        stream,
        createWriteStream(uploadPath, { flags: "wx", mode: 0o600 }),
        { signal: controller.signal },
      );
      write.catch(() => {});
    });
    parser.on("field", (name, value, info) => {
      if (name !== "targetFormat" || info.valueTruncated || info.nameTruncated)
        failure = invalid("Choose a valid output format.");
      else targetFormat = value.trim().toLowerCase();
    });
    for (const event of ["filesLimit", "fieldsLimit", "partsLimit"] as const) {
      parser.on(event, () => {
        failure = invalid("Upload one file and one output format per request.");
      });
    }
    const bound = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length;
        callback(
          bytes > maxBody
            ? invalid("This file exceeds the upload size limit.", 413)
            : null,
          chunk,
        );
      },
    });
    await pipeline(
      Readable.fromWeb(
        request.body as import("node:stream/web").ReadableStream<Uint8Array>,
      ),
      bound,
      parser,
      { signal: controller.signal },
    );
    await write;
    if (failure) throw failure;
    if (!uploadPath) throw invalid("Choose a file to convert.");
    if (!(await fs.stat(/* turbopackIgnore: true */ uploadPath)).size)
      throw invalid("This file is empty.");
    if (!/^[a-z0-9]{2,8}$/.test(targetFormat))
      throw invalid("Choose a valid output format.");
    return {
      uploadPath,
      originalName: originalName || "document",
      targetFormat,
    };
  } catch (err) {
    controller.abort();
    await write?.catch(() => {});
    if (uploadPath) await fs.rm(uploadPath, { force: true });
    if ((err as { status?: number })?.status) throw err;
    throw invalid(
      controller.signal.aborted
        ? "The upload was interrupted. Please try again."
        : "The upload could not be read.",
    );
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
  }
}
