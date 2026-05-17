import fs from "node:fs/promises";
import path from "node:path";

export async function fallbackCopy(input: {
  inputPath: string;
  outputPath: string;
  onProgress: (p: number) => Promise<void> | void;
}) {
  await input.onProgress(45);
  await fs.mkdir(path.dirname(input.outputPath), { recursive: true });
  await fs.copyFile(input.inputPath, input.outputPath);
  await input.onProgress(95);
  return input.outputPath;
}

