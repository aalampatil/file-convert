import path from "node:path";
import { lookup as lookupMime } from "mime-types";

import { convertImage } from "./image.js";
import { convertTextToPdf } from "./textPdf.js";
import { fallbackCopy } from "./fallback.js";

export async function convertFile(input: {
  inputPath: string;
  outputPath: string;
  targetFormat: string;
  onProgress: (p: number) => Promise<void> | void;
}): Promise<{ outputPath: string; conversion: "sharp" | "pdfkit" | "fallback" }> {
  const ext = path.extname(input.inputPath).slice(1).toLowerCase();
  const mime = (lookupMime(ext) || "").toString();
  const target = input.targetFormat.toLowerCase();

  // "Progress" is coarse; we emit a few staged updates so the UI feels alive.
  await input.onProgress(10);

  if (mime.startsWith("image/")) {
    const outputPath = await convertImage({
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      targetFormat: target,
      onProgress: input.onProgress
    });
    return { outputPath, conversion: "sharp" };
  }

  if (ext === "txt" && target === "pdf") {
    const outputPath = await convertTextToPdf({
      inputPath: input.inputPath,
      outputPath: input.outputPath,
      onProgress: input.onProgress
    });
    return { outputPath, conversion: "pdfkit" };
  }

  const outputPath = await fallbackCopy({
    inputPath: input.inputPath,
    outputPath: input.outputPath,
    onProgress: input.onProgress
  });
  return { outputPath, conversion: "fallback" };
}

