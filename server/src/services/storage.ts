import path from "node:path";
import fs from "node:fs/promises";

const dataRoot = path.join(process.cwd(), "data");
const uploadsRoot = path.join(dataRoot, "uploads");
const outputsRoot = path.join(dataRoot, "outputs");

export function uploadsDir() {
  return uploadsRoot;
}

export function outputsDir() {
  return outputsRoot;
}

export async function ensureDirs() {
  await fs.mkdir(uploadsRoot, { recursive: true });
  await fs.mkdir(outputsRoot, { recursive: true });
}

