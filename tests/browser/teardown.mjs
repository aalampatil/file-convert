import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
export default async function teardown() {
  const target = process.env.FOLIO_E2E_DATA_DIR;
  if (
    target &&
    path.dirname(target) === os.tmpdir() &&
    /^folio-e2e-/.test(path.basename(target))
  )
    await fs.rm(target, { recursive: true, force: true });
}
