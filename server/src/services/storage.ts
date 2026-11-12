import path from "node:path";
import fs from "node:fs/promises";
import { config } from "../config.js";
export const uploadsDir = () => path.join(config.dataDir, "uploads");
export const outputsDir = () => path.join(config.dataDir, "outputs");
export const recordsDir = () => path.join(config.dataDir, "jobs");
export async function ensureDirs() {
  await Promise.all([uploadsDir(), outputsDir(), recordsDir()].map(dir => fs.mkdir(dir, { recursive: true })));
}
