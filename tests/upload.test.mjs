import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "folio-upload-tests-"));
process.env.DATA_DIR = root;
process.env.MAX_UPLOAD_MB = "1";
const { receiveUpload } = await import("../.worker/upload.js");
const request = (form) =>
  new Request("http://localhost/api/jobs", { method: "POST", body: form });
function form(name = "notes.md", content = "# Notes") {
  const data = new FormData();
  data.append("file", new Blob([content]), name);
  data.append("targetFormat", "pdf");
  return data;
}
after(async () => {
  assert.equal(path.dirname(root), os.tmpdir());
  assert.match(path.basename(root), /^folio-upload-tests-/);
  await fs.rm(root, { recursive: true, force: true });
});
test("Streaming multipart accepts exactly one file and one format, including Unicode filenames", async () => {
  const result = await receiveUpload(request(form("résumé 你好.md")));
  assert.equal(result.originalName, "résumé 你好.md");
  assert.equal(result.targetFormat, "pdf");
  assert.equal(await fs.readFile(result.uploadPath, "utf8"), "# Notes");
  await fs.rm(result.uploadPath);
});
test("Additional multipart fields fail and leave no upload behind", async () => {
  const data = form();
  data.append("extra", "bad");
  await assert.rejects(
    receiveUpload(request(data)),
    (error) => error.status === 400,
  );
  assert.deepEqual(await fs.readdir(path.join(root, "uploads")), []);
});
test("Long filenames retain their supported extension", async () => {
  const result = await receiveUpload(request(form("a".repeat(240) + ".md")));
  assert.equal(result.originalName.length, 160);
  assert.ok(result.originalName.endsWith(".md"));
  await fs.rm(result.uploadPath);
});
test("Unsupported and oversized files are rejected and removed", async () => {
  await assert.rejects(
    receiveUpload(request(form("script.exe"))),
    (error) => error.status === 415,
  );
  await assert.rejects(
    receiveUpload(request(form("large.md", Buffer.alloc(1048577)))),
    (error) => error.status === 413,
  );
  assert.deepEqual(await fs.readdir(path.join(root, "uploads")), []);
});
