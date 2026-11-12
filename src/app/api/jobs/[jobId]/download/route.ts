import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { initialize } from "@/server/services/runtime";
import { getJobDownloadPath } from "@/server/services/jobs";
import { apiError, json, limit } from "@/server/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const mime: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    limit(request);
    await initialize();
    const download = await getJobDownloadPath((await params).jobId);
    if (!download)
      return json(
        { message: "This download is not ready or has expired." },
        404,
      );
    // Open before responding, so an expired/missing file yields a JSON error.
    const handle = await fs.open(download.absPath, "r").catch(() => null);
    if (!handle) return json({ message: "This download has expired." }, 404);
    const stat = await handle.stat();
    const stream = createReadStream(download.absPath, {
      fd: handle.fd,
      autoClose: false,
    });
    let closed = false;
    const close = () => {
      if (!closed) {
        closed = true;
        void handle.close();
      }
    };
    stream.once("close", close);
    stream.once("end", close);
    stream.once("error", close);
    const extension = download.absPath.split(".").pop() || "";
    const encoded = encodeURIComponent(download.downloadName).replace(
      /['()*]/g,
      (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
    );
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": mime[extension] || "application/octet-stream",
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="download.${extension}"; filename*=UTF-8''${encoded}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
