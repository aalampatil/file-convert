import fs from "node:fs/promises";
import PDFDocument from "pdfkit";
import path from "node:path";
import { createWriteStream } from "node:fs";

export async function convertTextToPdf(input: {
  inputPath: string;
  outputPath: string;
  onProgress: (p: number) => Promise<void> | void;
}) {
  const text = await fs.readFile(input.inputPath, "utf8");
  await input.onProgress(40);

  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });

  const doc = new PDFDocument({ margin: 48 });
  const out = createWriteStream(input.outputPath);
  doc.pipe(out);

  doc.font("Courier").fontSize(11).fillColor("#111111");
  doc.text(text || "(empty)", { width: 500 });
  doc.end();

  await input.onProgress(85);

  await new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("error", reject);
  });

  await input.onProgress(95);
  return input.outputPath;
}

