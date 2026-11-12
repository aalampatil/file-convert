import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import sharp from "sharp";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  ImageRun,
  HeadingLevel,
} from "docx";
import { officeAvailable } from "../.worker/services/supportedFormats.js";
import { convertFile } from "../.worker/services/converters/convertFile.js";
import { pdfLayoutAvailable } from "../.worker/services/pdfLayout.js";
const root = await fs.mkdtemp(path.join(os.tmpdir(), "folio-structure-tests-"));
const available = await pdfLayoutAvailable();
const office = await officeAvailable();
const image = await sharp({
  create: { width: 120, height: 60, channels: 3, background: "#b74629" },
})
  .png()
  .toBuffer();

test("PDF layout engine is installed when required", () => {
  if (process.env.REQUIRE_PDF_LAYOUT === "1")
    assert.ok(
      available,
      "Install requirements.txt into .venv or set PYTHON_PATH.",
    );
});
after(async () => {
  assert.equal(path.dirname(root), os.tmpdir());
  assert.match(path.basename(root), /^folio-structure-tests-/);
  await fs.rm(root, { recursive: true, force: true });
});
async function convert(name, content, target) {
  const inputPath = path.join(root, name),
    outputPath = path.join(
      root,
      path.parse(name).name + "-converted." + target,
    );
  await fs.writeFile(inputPath, content);
  await convertFile({
    inputPath,
    outputPath,
    targetFormat: target,
    onProgress: () => {},
  });
  return fs.readFile(outputPath);
}
async function structuredPdf() {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: "A4", margin: 48 }),
      chunks = [];
    pdf.on("data", (chunk) => chunks.push(chunk));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
    pdf.font("Helvetica-Bold").fontSize(24).text("Quarterly report");
    pdf.font("Helvetica").fontSize(11).text("Original introduction paragraph.");
    pdf.moveDown();
    pdf.font("Helvetica-Bold").text("Bold emphasis");
    pdf.font("Helvetica-Oblique").text("Italic emphasis");
    pdf.font("Helvetica").text("1. First action\n2. Second action");
    pdf.x = 48;
    pdf.y = 230;
    pdf.fontSize(11).table({
      columnStyles: [180, 180],
      defaultStyle: { border: 1, padding: 8 },
      data: [
        ["Metric", "Value"],
        ["Revenue", "-123"],
        ["Expenses", "45"],
      ],
    });
    pdf.image(image, 48, 400, { width: 120, height: 60 });
    pdf.addPage({ size: "A4", layout: "landscape" });
    pdf.font("Helvetica-Bold").fontSize(20).text("Second page");
    pdf
      .font("Helvetica")
      .fontSize(11)
      .text("The final paragraph remains on page two.");
    pdf.end();
  });
}
test(
  "Word to PDF retains headings, a table, an image and the original page dimensions",
  { skip: !office, timeout: 60000 },
  async () => {
    const word = await Packer.toBuffer(
      new Document({
        sections: [
          {
            properties: { page: { size: { width: 12240, height: 15840 } } },
            children: [
              new Paragraph({
                text: "Original Word heading",
                heading: HeadingLevel.HEADING_1,
              }),
              new Paragraph({
                children: [
                  new TextRun({ text: "Original bold text", bold: true }),
                  new TextRun(" and ordinary text."),
                ],
              }),
              new Table({
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph("Item")] }),
                      new TableCell({ children: [new Paragraph("Count")] }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [new Paragraph("Retained item")],
                      }),
                      new TableCell({ children: [new Paragraph("12")] }),
                    ],
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new ImageRun({
                    type: "png",
                    data: image,
                    transformation: { width: 120, height: 60 },
                  }),
                ],
              }),
            ],
          },
        ],
      }),
    );
    const converted = await convert("structured-word.docx", word, "pdf");
    const task = getDocument({ data: new Uint8Array(converted), verbosity: 0 }),
      pdf = await task.promise;
    try {
      const page = await pdf.getPage(1);
      assert.ok(Math.abs(page.view[2] - 612) < 1);
      assert.ok(Math.abs(page.view[3] - 792) < 1);
    } finally {
      await task.destroy();
    }
    if (available) {
      const archive = await JSZip.loadAsync(
        await convert("word-structure-roundtrip.pdf", converted, "docx"),
      );
      const xml = await archive.file("word/document.xml").async("string");
      for (const phrase of [
        "Original Word heading",
        "Original bold text",
        "Retained item",
        "12",
      ])
        assert.ok(xml.includes(phrase), phrase);
      assert.match(xml, /<w:tbl>/);
      assert.ok(
        Object.keys(archive.files).some((name) =>
          name.startsWith("word/media/"),
        ),
      );
    }
  },
);
test(
  "PDF to Word retains headings, emphasis, real table cells, images and page sizes",
  { skip: !available, timeout: 60000 },
  async () => {
    const output = await convert(
      "structured.pdf",
      await structuredPdf(),
      "docx",
    );
    const archive = await JSZip.loadAsync(output);
    const xml = await archive.file("word/document.xml").async("string");
    for (const text of [
      "Quarterly report",
      "Original introduction paragraph.",
      "Bold emphasis",
      "Italic emphasis",
      "First action",
      "Second action",
      "Metric",
      "Revenue",
      "-123",
      "Expenses",
      "45",
      "Second page",
      "The final paragraph remains on page two.",
    ])
      assert.ok(xml.includes(text), text);
    assert.match(xml, /<w:tbl>/);
    assert.match(xml, /<w:tr>/);
    assert.match(xml, /<w:tc>/);
    assert.match(xml, /<w:b(?:\s[^>]*)?\/>/);
    assert.match(xml, /<w:i(?:\s[^>]*)?\/>/);
    assert.ok(
      Object.keys(archive.files).some((name) => name.startsWith("word/media/")),
    );
    const sections = [...xml.matchAll(/<w:pgSz\b[^>]+>/g)].map(
      (match) => match[0],
    );
    assert.ok(sections.length >= 2, "Original page sections must be retained.");
    assert.ok(
      new Set(sections).size >= 2,
      "Portrait and landscape page sizes must be retained.",
    );
    assert.ok(
      xml.indexOf("Quarterly report") < xml.indexOf("Second page"),
      "Reading order must be retained.",
    );
  },
);
test(
  "Image-only PDF pages remain images in Word instead of being discarded",
  { skip: !available, timeout: 30000 },
  async () => {
    const buffer = await new Promise((resolve) => {
      const pdf = new PDFDocument(),
        chunks = [];
      pdf.on("data", (chunk) => chunks.push(chunk));
      pdf.on("end", () => resolve(Buffer.concat(chunks)));
      pdf.image(image, 54, 54);
      pdf.end();
    });
    const archive = await JSZip.loadAsync(
      await convert("image-only.pdf", buffer, "docx"),
    );
    assert.ok(
      Object.keys(archive.files).some((name) => name.startsWith("word/media/")),
    );
  },
);
test("Markdown retains heading levels, emphasis, nested list order, tables and embedded images", async () => {
  const markdown = [
    "# Main heading",
    "",
    "## Section heading",
    "",
    "A **bold phrase**, an *italic phrase*, and a [reference](https://example.com).",
    "",
    "1. Parent item",
    "   - Child item",
    "2. Next parent",
    "",
    "| Name | Quantity |",
    "| --- | --- |",
    "| Widget | **42** |",
    "",
    "![Diagram](data:image/png;base64," + image.toString("base64") + ")",
  ].join("\n");
  const buffer = await convert("structure.md", markdown, "pdf");
  const loading = getDocument({ data: new Uint8Array(buffer), verbosity: 0 }),
    pdf = await loading.promise;
  try {
    const page = await pdf.getPage(1),
      content = await page.getTextContent();
    const items = content.items.filter((item) => "str" in item);
    const text = items
      .map((item) => item.str)
      .join(" ")
      .replace(/\s+/g, " ");
    for (const phrase of [
      "Main heading",
      "Section heading",
      "bold phrase",
      "italic phrase",
      "Parent item",
      "Child item",
      "Next parent",
      "Widget",
      "42",
    ])
      assert.ok(text.includes(phrase), phrase);
    assert.ok(
      items.find((item) => item.str.includes("Main heading")).height >
        items.find((item) => item.str.includes("Section heading")).height,
    );
    assert.ok(
      text.indexOf("Parent item") < text.indexOf("Child item") &&
        text.indexOf("Child item") < text.indexOf("Next parent"),
    );
    assert.ok(
      (await page.getAnnotations()).some(
        (annotation) => annotation.url === "https://example.com/",
      ),
    );
  } finally {
    await loading.destroy();
  }
  if (available) {
    const archive = await JSZip.loadAsync(
      await convert("markdown-roundtrip.pdf", buffer, "docx"),
    );
    const xml = await archive.file("word/document.xml").async("string");
    assert.match(xml, /<w:tbl>/);
    assert.match(xml, /<w:b(?:\s[^>]*)?\/>/);
    assert.match(xml, /<w:i(?:\s[^>]*)?\/>/);
    assert.ok(
      Object.keys(archive.files).some((name) => name.startsWith("word/media/")),
    );
  }
});
test("Markdown rejects unavailable images and raw HTML rather than omitting content", async () => {
  await assert.rejects(
    convert(
      "linked-image.md",
      "# Chart\n\n![Chart](https://example.com/chart.png)",
      "pdf",
    ),
    /linked image/,
  );
  await assert.rejects(
    convert(
      "raw-html.md",
      "<table><tr><td>Important content</td></tr></table>",
      "pdf",
    ),
    /raw HTML/,
  );
});

test("Markdown table rows do not overlap wrapped inline code", async () => {
  const code = "i".repeat(80);
  const buffer = await convert(
    "wrapped-cell.md",
    "| Name | Value |\n| --- | --- |\n| Code sample | `" +
      code +
      "` |\n| Next row | Preserved |",
    "pdf",
  );
  const task = getDocument({ data: new Uint8Array(buffer), verbosity: 0 }),
    pdf = await task.promise;
  try {
    const items = (await (await pdf.getPage(1)).getTextContent()).items.filter(
      (item) => "str" in item,
    );
    const codeRuns = items.filter((item) =>
      /^i+$/.test(item.str.replace(/\s/g, "")),
    );
    assert.equal(
      codeRuns.map((item) => item.str.replace(/\s/g, "")).join("").length,
      80,
    );
    const next = items.find((item) => item.str.includes("Next row"));
    assert.ok(next && codeRuns.length > 1);
    assert.ok(
      next.transform[5] <
        Math.min(...codeRuns.map((item) => item.transform[5])),
      "The following row must start below every wrapped code line.",
    );
  } finally {
    await task.destroy();
  }
});
