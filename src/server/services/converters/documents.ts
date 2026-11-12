import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { convertPdfLayout } from "../pdfLayout.ts";
import type { ConversionInput } from "./convertFile.ts";
import { officeExecutable, officeAvailable } from "../supportedFormats.ts";
const exec = promisify(execFile);

export async function convertWordToPdf(input: ConversionInput) {
  if (!(await officeAvailable()))
    throw new Error(
      "Word conversion requires LibreOffice. Use the Docker image or configure LIBREOFFICE_PATH.",
    );
  const workDir = await fs.mkdtemp(
    path.join(path.dirname(input.outputPath), "office-"),
  );
  try {
    const profile = path.join(workDir, "profile");
    await fs.mkdir(path.join(profile, "user"), { recursive: true });
    // Disable macros, external-link updates and recovery for this disposable profile.
    await fs.writeFile(
      path.join(profile, "user", "registrymodifications.xcu"),
      `<?xml version="1.0"?>
<oor:items xmlns:oor="http://openoffice.org/2001/registry">
<item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item>
<item oor:path="/org.openoffice.Office.Writer/Content/Update"><prop oor:name="Link" oor:op="fuse"><value>2</value></prop></item>
</oor:items>`,
    );
    await input.onProgress(30);
    await exec(
      officeExecutable(),
      [
        `-env:UserInstallation=${pathToFileURL(profile).href}`,
        "--headless",
        "--nologo",
        "--nodefault",
        "--norestore",
        "--convert-to",
        "pdf:writer_pdf_Export",
        "--outdir",
        workDir,
        input.inputPath,
      ],
      { timeout: 105_000, maxBuffer: 1024 * 1024, windowsHide: true },
    );
    const result = path.join(
      workDir,
      `${path.parse(input.inputPath).name}.pdf`,
    );
    const handle = await fs.open(result, "r").catch(() => {
      throw new Error(
        "This Word document could not be opened. Check that it is valid and not password-protected.",
      );
    });
    const magic = Buffer.alloc(5);
    try {
      await handle.read(magic, 0, 5, 0);
    } finally {
      await handle.close();
    }
    if (magic.toString() !== "%PDF-")
      throw new Error("The document renderer did not produce a valid PDF.");
    await fs.rename(result, input.outputPath);
    await input.onProgress(95);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

export async function convertPdfToWord(input: ConversionInput) {
  await input.onProgress(20);
  await convertPdfLayout(input.inputPath, input.outputPath);
  await input.onProgress(95);
}
