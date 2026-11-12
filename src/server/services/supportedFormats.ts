import path from "node:path";
import { access } from "node:fs/promises";
import { config } from "../config.ts";
import { pdfLayoutAvailable } from "./pdfLayout.ts";
export const conversionGroups = [
  {
    id: "markdown",
    title: "Markdown to PDF",
    inputs: ["md", "markdown"],
    outputs: ["pdf"],
    note: "Preserves headings, emphasis, nested lists, tables, links and embedded PNG/JPEG images. Linked images and raw HTML are rejected to prevent missing content.",
  },
  {
    id: "word",
    title: "Word to PDF",
    inputs: ["doc", "docx"],
    outputs: ["pdf"],
    note: "Word documents, rendered with LibreOffice.",
  },
  {
    id: "pdf",
    title: "PDF to Word",
    inputs: ["pdf"],
    outputs: ["docx"],
    note: "Preserves text formatting, tables, images and page layout where supported. Complex layouts may need review. Scanned content remains an image; no OCR.",
  },
  {
    id: "image",
    title: "Image converter",
    inputs: ["png", "jpg", "jpeg", "webp"],
    outputs: ["png", "jpg", "webp"],
    note: "Convert between PNG, JPEG and WebP.",
  },
  {
    id: "text",
    title: "Text to PDF",
    inputs: ["txt"],
    outputs: ["pdf"],
    note: "Plain text in a clean PDF document.",
  },
];
export function assertConversion(name: string, target: string) {
  const ext = path.extname(name).slice(1).toLowerCase();
  if (
    !conversionGroups.some(
      (g) => g.inputs.includes(ext) && g.outputs.includes(target),
    )
  ) {
    throw Object.assign(
      new Error(
        `Conversion from ${ext || "this file type"} to ${target.toUpperCase()} is not supported.`,
      ),
      { status: 422 },
    );
  }
}
export function officeExecutable() {
  return (
    process.env.LIBREOFFICE_PATH ||
    (process.platform === "win32"
      ? "C:/Program Files/LibreOffice/program/soffice.exe"
      : "/usr/bin/libreoffice")
  );
}
export async function officeAvailable() {
  return access(officeExecutable()).then(
    () => true,
    () => false,
  );
}
export async function supportedFormats() {
  const [office, pdfLayout] = await Promise.all([
    officeAvailable(),
    pdfLayoutAvailable(),
  ]);
  return {
    maxUploadBytes: config.maxUploadBytes,
    retentionHours: config.retentionMs / 3600000,
    groups: conversionGroups.map((g) => ({
      ...g,
      available: g.id === "word" ? office : g.id === "pdf" ? pdfLayout : true,
    })),
  };
}
