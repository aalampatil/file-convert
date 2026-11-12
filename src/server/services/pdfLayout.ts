import path from "node:path";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
export const pythonEnvironment = () => ({
  ...process.env,
  OMP_NUM_THREADS: "1",
  OPENBLAS_NUM_THREADS: "1",
  NUMEXPR_NUM_THREADS: "1",
});
export function pythonExecutable() {
  if (process.env.PYTHON_PATH) return process.env.PYTHON_PATH;
  const local = path.join(
    process.cwd(),
    ".venv",
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
  if (existsSync(/* turbopackIgnore: true */ local)) return local;
  return process.platform === "win32" ? "python" : "/usr/bin/python3";
}
type Availability = { expires: number; pending: Promise<boolean> };
const globals = globalThis as typeof globalThis & {
  folioPdfLayout?: Availability;
};
export function pdfLayoutAvailable() {
  if (!globals.folioPdfLayout || globals.folioPdfLayout.expires < Date.now()) {
    globals.folioPdfLayout = {
      expires: Date.now() + 60000,
      pending: exec(
        pythonExecutable(),
        ["-c", "import pdf2docx; import pymupdf"],
        {
          timeout: 10000,
          windowsHide: true,
          env: pythonEnvironment(),
        },
      ).then(
        () => true,
        () => false,
      ),
    };
  }
  return globals.folioPdfLayout.pending;
}
export async function convertPdfLayout(inputPath: string, outputPath: string) {
  if (!(await pdfLayoutAvailable()))
    throw new Error(
      "PDF conversion requires the layout engine. Use Docker or install requirements.txt in .venv.",
    );
  try {
    await exec(
      pythonExecutable(),
      [
        path.join(process.cwd(), "scripts/convert_pdf.py"),
        inputPath,
        outputPath,
      ],
      {
        timeout: 105000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
        env: pythonEnvironment(),
      },
    );
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    if (result.stderr)
      console.error("PDF layout renderer:", result.stderr.slice(-4000));
    let message =
      "This PDF could not be converted while preserving its structure.";
    try {
      const data = JSON.parse(
        (result.stdout || "")
          .trim()
          .split(/\r?\n/)
          .reverse()
          .find((line) => line.startsWith("{")) || "{}",
      );
      if (typeof data.error === "string") message = data.error;
    } catch {
      /* Use the safe conversion error. */
    }
    throw new Error(message);
  }
}
