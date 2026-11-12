import { convertFile } from "./convertFile.js";
process.once("message", async (input: { inputPath: string; outputPath: string; targetFormat: string }) => {
  try {
    const result = await convertFile({ ...input, onProgress: p => { process.send?.({ progress: p }); } });
    process.send?.({ result }, () => process.disconnect());
  } catch (err) {
    console.error("Conversion failed:", err);
    const known = err instanceof Error && /^(No selectable|PDFs are limited|Text and Markdown|This Markdown|This Word|Word conversion|The document renderer)/.test(err.message);
    const message = known ? (err as Error).message : "This file could not be converted. Check that it is valid and not password-protected.";
    process.send?.({ error: message }, () => process.disconnect());
  }
});
