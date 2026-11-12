import path from "node:path";
import { assertConversion } from "../supportedFormats.js";
import type { ConversionEngine } from "../jobTypes.js";
import { convertImage } from "./image.js";
import { convertTextToPdf } from "./textPdf.js";
import { convertWordToPdf, convertPdfToWord } from "./documents.js";
export type ConversionInput = { inputPath: string; outputPath: string; targetFormat: string; onProgress: (p: number) => Promise<void> | void };
export async function convertFile(input: ConversionInput): Promise<{ outputPath: string; conversion: ConversionEngine }> {
  assertConversion(input.inputPath, input.targetFormat);
  const ext = path.extname(input.inputPath).slice(1).toLowerCase();
  await input.onProgress(10);
  let conversion: ConversionEngine;
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) { await convertImage(input); conversion = "sharp"; }
  else if (["txt", "md", "markdown"].includes(ext)) { await convertTextToPdf(input); conversion = "pdfkit"; }
  else if (["doc", "docx"].includes(ext)) { await convertWordToPdf(input); conversion = "libreoffice"; }
  else { await convertPdfToWord(input); conversion = "pdfjs"; }
  return { outputPath: input.outputPath, conversion };
}
