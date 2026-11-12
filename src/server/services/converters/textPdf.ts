import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import PDFDocument from "pdfkit";
import { marked, type Token, type Tokens } from "marked";
import type { ConversionInput } from "./convertFile.ts";

export async function convertTextToPdf(input: ConversionInput) {
  const info = await fs.stat(input.inputPath);
  if (info.size > 2 * 1024 * 1024) throw new Error("Text and Markdown documents are limited to 2 MB.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(input.inputPath));
  await input.onProgress(30);
  const doc = new PDFDocument({ margin: 54, size: "A4", info: { Creator: "Folio" } });
  const regular = process.env.PDF_FONT_PATH || "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
  const bold = process.env.PDF_BOLD_FONT_PATH || "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
  const bodyFont = existsSync(regular) ? regular : "Helvetica";
  const boldFont = existsSync(bold) ? bold : "Helvetica-Bold";
  const result = pipeline(doc, createWriteStream(input.outputPath));
  // Attach rejection handling before rendering so disk errors never become unhandled.
  result.catch(() => {});
  doc.font(bodyFont).fontSize(11).fillColor("#20242b");
  const width = doc.page.width - 108;
  function inline(tokens: Token[] = []): string {
    return tokens.map(t => {
      if (t.type === "html") return "";
      if (t.type === "image") return `[Image: ${t.text || "omitted"}]`;
      if (t.type === "br") return "\n";
      if ("tokens" in t && t.tokens) return inline(t.tokens);
      return "text" in t && typeof t.text === "string" ? t.text : "";
    }).join("");
  }
  function paragraph(value: string, font = bodyFont, size = 11, indent = 0) {
    doc.font(font).fontSize(size).text(value, 54 + indent, doc.y, { width: width - indent, lineGap: 4 });
    doc.moveDown(0.6);
  }
  function blocks(tokens: Token[] = [], indent = 0, depth = 0) {
    if (depth > 20) throw new Error("This Markdown document is nested too deeply.");
    for (const token of tokens) {
      switch (token.type) {
        case "heading":
          if (doc.y > doc.page.height - 140) doc.addPage();
          paragraph(inline(token.tokens), boldFont, [26, 22, 17, 14, 12, 11][token.depth - 1], indent);
          break;
        case "paragraph": case "text":
          paragraph(token.tokens ? inline(token.tokens) : token.text, bodyFont, 11, indent); break;
        case "code": paragraph(token.text, "Courier", 9, indent + 12); break;
        case "blockquote": blocks(token.tokens, indent + 16, depth + 1); break;
        case "list": {
          const list = token as Tokens.List;
          list.items.forEach((item, i) => {
            const prefix = list.ordered ? `${Number(list.start) + i}. ` : "• ";
            paragraph(prefix + inline(marked.lexer(item.text)), bodyFont, 11, indent + 10);
          });
          break;
        }
        case "table": {
          const table = token as Tokens.Table;
          paragraph(table.header.map(c => inline(c.tokens)).join("  |  "), boldFont, 10, indent);
          table.rows.forEach(row => paragraph(row.map(c => inline(c.tokens)).join("  |  "), bodyFont, 10, indent));
          break;
        }
        case "hr":
          doc.moveTo(54 + indent, doc.y).lineTo(54 + width, doc.y).strokeColor("#dddddd").stroke(); doc.moveDown(); break;
      }
    }
  }
  try {
    if (path.extname(input.inputPath).toLowerCase() === ".txt") paragraph(text || "(empty document)");
    else blocks(marked.lexer(text));
    doc.end();
    await result;
  } catch (err) {
    doc.destroy(err as Error);
    await result.catch(() => {});
    throw err;
  }
  await input.onProgress(95);
}
