import { test, expect } from "@playwright/test";
import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import sharp from "sharp";
test("Markdown upload converts, downloads, and survives a page reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Same good work.",
  );
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.screenshot({
    path: "test-results/desktop-workspace.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Convert file", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Choose file to convert").setInputFiles({
    name: "release.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# Browser fixture\n\nA useful document."),
  });
  await page.getByRole("button", { name: "Convert file", exact: true }).click();
  const downloadLink = page.getByRole("link", { name: "Download release.pdf" });
  await expect(downloadLink).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("release.pdf");
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
  await page.reload();
  await expect(downloadLink).toBeVisible();
  expect(errors).toEqual([]);
});
test("Word to PDF and PDF to Word work through the production API", async ({
  request,
}) => {
  const formats = await (await request.get("/api/formats")).json();
  const office = formats.groups.find(
    (g: { id: string }) => g.id === "word",
  ).available;
  const word = await Packer.toBuffer(
    new Document({
      sections: [{ children: [new Paragraph("Browser Word fixture")] }],
    }),
  );
  if (!office) {
    const unavailable = await request.post("/api/jobs", {
      multipart: {
        file: {
          name: "document.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          buffer: word,
        },
        targetFormat: "pdf",
      },
    });
    expect(unavailable.status()).toBe(503);
    test.skip(
      process.env.REQUIRE_OFFICE !== "1",
      "LibreOffice is not installed locally.",
    );
    expect(office).toBe(true);
    return;
  }
  const response = await request.post("/api/jobs", {
    multipart: {
      file: {
        name: "document.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: word,
      },
      targetFormat: "pdf",
    },
  });
  expect(response.status()).toBe(201);
  const job = await response.json();
  expect(job.uploadPath).toBeUndefined();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/jobs/" + job.id)).json()).status,
    )
    .toBe("finished");
  const pdf = await (
    await request.get("/api/jobs/" + job.id + "/download")
  ).body();
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  const exported = await request.post("/api/jobs", {
    multipart: {
      file: { name: "document.pdf", mimeType: "application/pdf", buffer: pdf },
      targetFormat: "docx",
    },
  });
  expect(exported.status()).toBe(201);
  const next = await exported.json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/jobs/" + next.id)).json()).status,
    )
    .toBe("finished");
  const result = await request.get("/api/jobs/" + next.id + "/download");
  expect(result.headers()["content-type"]).toContain("wordprocessingml");
  expect((await result.body()).subarray(0, 2).toString()).toBe("PK");
});
test("Wrong types and oversized uploads are rejected", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByLabel("Choose file to convert").setInputFiles({
    name: "wrong.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Choose a .md",
  );
  await expect(
    page.getByRole("button", { name: "Convert file", exact: true }),
  ).toBeDisabled();
  const unsupported = await request.post("/api/jobs", {
    multipart: {
      file: {
        name: "script.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("bad"),
      },
      targetFormat: "pdf",
    },
  });
  expect(unsupported.status()).toBe(415);
  const mismatch = await request.post("/api/jobs", {
    multipart: {
      file: {
        name: "file.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("bad"),
      },
      targetFormat: "png",
    },
  });
  expect(mismatch.status()).toBe(422);
  const oversized = await request.post("/api/jobs", {
    multipart: {
      file: {
        name: "large.md",
        mimeType: "text/markdown",
        buffer: Buffer.alloc(1024 * 1024 + 1, 65),
      },
      targetFormat: "pdf",
    },
  });
  expect(oversized.status()).toBe(413);
  const missing = await request.get("/api/jobs/unknown/download");
  expect(missing.status()).toBe(404);
});
test("Corrupt files report a failed job in the UI", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PDF to Word" }).click();
  await page.getByLabel("Choose file to convert").setInputFiles({
    name: "broken.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("not a pdf"),
  });
  await page.getByRole("button", { name: "Convert file", exact: true }).click();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(page.getByText(/could not be converted/i)).toBeVisible();
});
test("Mobile layout fits and all tools are accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "All 5 converters" }).click();
  await page.getByRole("button", { name: "Image converter" }).click();
  await expect(page.getByLabel("OUTPUT FORMAT")).toHaveValue("png");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/mobile-workspace.png",
    fullPage: true,
  });
});
test("API outages are visible and retry restores the converter", async ({
  page,
}) => {
  await page.route("**/api/formats", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "could not reach",
  );
  await page.unroute("**/api/formats");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Ready when you are")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
});

test("Downloaded conversions retain document tables, styled text and images", async ({
  request,
}) => {
  const formats = await (await request.get("/api/formats")).json();
  const layout = formats.groups.find(
    (group: { id: string }) => group.id === "pdf",
  ).available;
  if (process.env.REQUIRE_PDF_LAYOUT === "1") expect(layout).toBe(true);
  test.skip(!layout, "The PDF layout engine is not installed.");
  const image = await sharp({
    create: { width: 120, height: 60, channels: 3, background: "#d46342" },
  })
    .png()
    .toBuffer();
  const markdown =
    "# Preserved heading\n\nA **bold phrase** and an *italic phrase*.\n\n- Parent item\n  - Nested item\n\n| Product | Quantity |\n| --- | --- |\n| Original item | 42 |\n\n![Figure](data:image/png;base64," +
    image.toString("base64") +
    ")";
  const uploaded = await request.post("/api/jobs", {
    multipart: {
      file: {
        name: "structure.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(markdown),
      },
      targetFormat: "pdf",
    },
  });
  expect(uploaded.status()).toBe(201);
  const first = await uploaded.json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/jobs/" + first.id)).json()).status,
    )
    .toBe("finished");
  const pdf = await (
    await request.get("/api/jobs/" + first.id + "/download")
  ).body();
  const exported = await request.post("/api/jobs", {
    multipart: {
      file: { name: "structure.pdf", mimeType: "application/pdf", buffer: pdf },
      targetFormat: "docx",
    },
  });
  expect(exported.status()).toBe(201);
  const next = await exported.json();
  await expect
    .poll(
      async () =>
        (await (await request.get("/api/jobs/" + next.id)).json()).status,
    )
    .toBe("finished");
  const archive = await JSZip.loadAsync(
    await (await request.get("/api/jobs/" + next.id + "/download")).body(),
  );
  const xml = await archive.file("word/document.xml")!.async("string");
  for (const text of [
    "Preserved heading",
    "bold phrase",
    "italic phrase",
    "Nested item",
    "Original item",
    "42",
  ])
    expect(xml).toContain(text);
  expect(xml).toContain("<w:tbl>");
  expect(xml).toMatch(/<w:b(?:\s[^>]*)?\/>/);
  expect(xml).toMatch(/<w:i(?:\s[^>]*)?\/>/);
  expect(
    Object.keys(archive.files).some((name) => name.startsWith("word/media/")),
  ).toBe(true);
});
