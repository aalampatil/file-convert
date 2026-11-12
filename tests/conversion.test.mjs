import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "folio-tests-"));
process.env.DATA_DIR = path.join(root, "data");
process.env.CONVERSION_CONCURRENCY = "1";
process.env.MAX_PENDING_JOBS = "1";
const { convertFile } =
  await import("../.worker/services/converters/convertFile.js");
const { officeAvailable, officeExecutable, assertConversion } =
  await import("../.worker/services/supportedFormats.js");
const { ensureDirs, uploadsDir, outputsDir } =
  await import("../.worker/services/storage.js");
const store = await import("../.worker/services/jobStore.js");
const jobs = await import("../.worker/services/jobs.js");
const { publicJob } = await import("../.worker/services/jobTypes.js");
await ensureDirs();
const progress = () => {};
async function fixture(name, content) {
  const file = path.join(root, name);
  await fs.writeFile(file, content);
  return file;
}
async function convert(name, content, target) {
  const inputPath = await fixture(name, content);
  const outputPath = path.join(
    root,
    path.parse(name).name + "-result." + target,
  );
  await convertFile({
    inputPath,
    outputPath,
    targetFormat: target,
    onProgress: progress,
  });
  return fs.readFile(outputPath);
}
async function pdfBuffer(text) {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument();
    const chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    if (text) pdf.text(text);
    pdf.end();
  });
}
async function pdfText(buffer) {
  const task = getDocument({ data: new Uint8Array(buffer), verbosity: 0 });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++)
      pages.push(
        (await (await pdf.getPage(n)).getTextContent()).items
          .filter((x) => "str" in x)
          .map((x) => x.str)
          .join(" "),
      );
    return pages.join("\n").replace(/\s+/g, " ");
  } finally {
    await task.destroy();
  }
}
after(async () => {
  await jobs.stopJobs();
  assert.equal(path.dirname(root), os.tmpdir());
  assert.match(path.basename(root), /^folio-tests-/);
  await fs.rm(root, { recursive: true, force: true });
});
test("Markdown produces a PDF containing headings, lists, code and tables", async () => {
  const buffer = await convert(
    "guide.md",
    "# Release notes\n\nA **useful** guide.\n\n- First item\n- Second item\n\n```js\nconst ready = true;\n```\n\n| Name | Value |\n| --- | --- |\n| Version | One |",
    "pdf",
  );
  assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
  const text = await pdfText(buffer);
  for (const word of ["Release notes", "First item", "const ready", "Version"])
    assert.ok(text.includes(word), word + ": " + JSON.stringify(text));
});
test("Plain text produces a real PDF", async () => {
  const text = await pdfText(
    await convert("notes.txt", "A plain text document.", "pdf"),
  );
  assert.match(text, /plain text document/);
});
test("PDF exports a valid editable Word document with extracted content", async () => {
  const buffer = await convert(
    "source.pdf",
    await pdfBuffer("Editable content 123"),
    "docx",
  );
  assert.equal(buffer.subarray(0, 2).toString(), "PK");
  const archive = await JSZip.loadAsync(buffer);
  const xml = await archive.file("word/document.xml").async("string");
  assert.match(xml, /Editable content 123/);
  assert.ok(archive.file("[Content_Types].xml"));
});
test("Scanned or blank PDFs fail clearly instead of creating empty Word files", async () => {
  await assert.rejects(
    convert("blank.pdf", await pdfBuffer(), "docx"),
    /No selectable text/,
  );
});
test("Corrupt PDFs fail", async () => {
  await assert.rejects(convert("broken.pdf", "not a pdf", "docx"));
});
test("Images are encoded in the requested format", async () => {
  const png = await sharp({
    create: { width: 8, height: 6, channels: 3, background: "#d56b44" },
  })
    .png()
    .toBuffer();
  const jpeg = await convert("picture.png", png, "jpg");
  assert.equal(jpeg[0], 0xff);
  assert.equal(jpeg[1], 0xd8);
  const meta = await sharp(jpeg).metadata();
  assert.equal(meta.format, "jpeg");
  assert.equal(meta.width, 8);
});
test("Unsupported pairs never copy or relabel files", () => {
  assert.throws(() => assertConversion("report.pdf", "png"), /not supported/);
  assert.throws(() => assertConversion("image.png", "../pdf"), /not supported/);
});
test(
  "DOCX and legacy DOC render through LibreOffice",
  { timeout: 60000 },
  async (context) => {
    const available = await officeAvailable();
    if (!available) {
      if (process.env.REQUIRE_OFFICE === "1")
        assert.fail("LibreOffice is required for this test run.");
      context.skip(
        "LibreOffice not installed; Docker and CI run this test with REQUIRE_OFFICE=1.",
      );
      return;
    }
    const word = await Packer.toBuffer(
      new Document({
        sections: [{ children: [new Paragraph("Word conversion fixture")] }],
      }),
    );
    assert.match(
      await pdfText(await convert("word.docx", word, "pdf")),
      /Word conversion fixture/,
    );
    const profile = pathToFileURL(path.join(root, "doc-profile")).href;
    await promisify(execFile)(
      officeExecutable(),
      [
        `-env:UserInstallation=${profile}`,
        "--headless",
        "--convert-to",
        "doc:MS Word 97",
        "--outdir",
        root,
        path.join(root, "word.docx"),
      ],
      { timeout: 30000, windowsHide: true },
    );
    const legacy = await fs.readFile(path.join(root, "word.doc"));
    assert.equal(legacy.subarray(0, 4).toString("hex"), "d0cf11e0");
    assert.match(
      await pdfText(await convert("legacy.doc", legacy, "pdf")),
      /Word conversion fixture/,
    );
  },
);
test("Admission control bounds queued uploads and releases reservations", () => {
  const first = jobs.reserveUpload(),
    second = jobs.reserveUpload();
  assert.throws(() => jobs.reserveUpload(), /busy/);
  first();
  first();
  second();
  jobs.reserveUpload()();
});
test(
  "Worker queue persists completion and public jobs hide disk paths",
  { timeout: 15000 },
  async () => {
    const inputPath = path.join(uploadsDir(), "queue.txt");
    await fs.writeFile(inputPath, "Queue content");
    const job = await jobs.createJob({
      originalName: "queue.txt",
      uploadPath: inputPath,
      targetFormat: "pdf",
    });
    let current;
    for (let n = 0; n < 120; n++) {
      current = await jobs.getJob(job.id);
      if (["finished", "failed"].includes(current.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(current.status, "finished", current.message);
    assert.equal(publicJob(current).uploadPath, undefined);
    assert.equal(publicJob(current).result.outputPath, undefined);
    assert.equal(
      (await fs.readFile(current.result.outputPath)).subarray(0, 5).toString(),
      "%PDF-",
    );
    assert.ok(
      (await fs.readdir(path.join(process.env.DATA_DIR, "jobs"))).includes(
        job.id + ".json",
      ),
    );
    await assert.rejects(fs.access(inputPath));
    await store.updateJob(job.id, {
      expiresAt: new Date(Date.now() - 1).toISOString(),
    });
    assert.equal(await jobs.getJob(job.id), null);
    await jobs.cleanupExpired();
    assert.equal(await store.getJobFromStore(job.id), null);
    await assert.rejects(fs.access(path.join(outputsDir(), job.id)));
  },
);
test("Startup recovery marks interrupted conversions failed", async () => {
  const id = "x".repeat(32),
    input = path.join(uploadsDir(), "interrupted.txt");
  await fs.writeFile(input, "interrupted");
  await store.putJob({
    id,
    uploadPath: input,
    originalName: "interrupted.txt",
    targetFormat: "pdf",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    status: "processing",
    progress: 45,
  });
  await store.loadJobs();
  assert.equal((await store.getJobFromStore(id)).status, "failed");
  assert.match((await store.getJobFromStore(id)).message, /restarted/);
});
