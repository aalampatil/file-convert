import fs from "node:fs/promises";
import { existsSync, createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { decodeHTML } from "entities";
import { marked, type Token, type Tokens } from "marked";
import type { ConversionInput } from "./convertFile.ts";

type Style = {
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  strike?: boolean;
  link?: string;
};
type TextRun = Style & { text: string };
type ImageRun = { image: string; alt: string };
type Run = TextRun | ImageRun;

export async function convertTextToPdf(input: ConversionInput) {
  const info = await fs.stat(input.inputPath);
  if (info.size > 2 * 1024 * 1024)
    throw new Error("Text and Markdown documents are limited to 2 MB.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(
    await fs.readFile(input.inputPath),
  );
  await input.onProgress(30);
  const doc = new PDFDocument({
    margin: 54,
    size: "A4",
    info: { Creator: "Folio" },
  });
  const pick = (file: string, fallback: string) =>
    existsSync(file) ? file : fallback;
  const fonts = {
    regular: pick(
      process.env.PDF_FONT_PATH ||
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "Helvetica",
    ),
    bold: pick(
      process.env.PDF_BOLD_FONT_PATH ||
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
      "Helvetica-Bold",
    ),
    italic: pick(
      process.env.PDF_ITALIC_FONT_PATH ||
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
      "Helvetica-Oblique",
    ),
    boldItalic: pick(
      process.env.PDF_BOLD_ITALIC_FONT_PATH ||
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf",
      "Helvetica-BoldOblique",
    ),
    mono: pick(
      "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
      "Courier",
    ),
  };
  const result = pipeline(doc, createWriteStream(input.outputPath));
  result.catch(() => {});
  const width = doc.page.width - 108;

  function runs(tokens: Token[] = [], style: Style = {}, depth = 0): Run[] {
    if (depth > 30)
      throw new Error("This Markdown document is nested too deeply.");
    return tokens.flatMap((token): Run[] => {
      const nested = "tokens" in token ? token.tokens : undefined;
      switch (token.type) {
        case "html":
          if (/^\s*<!--[\s\S]*-->\s*$/.test(token.raw)) return [];
          throw new Error(
            "This Markdown document contains raw HTML that cannot be preserved. Use Markdown formatting instead.",
          );
        case "image":
          return [{ image: token.href, alt: token.text || "" }];
        case "br":
          return [{ ...style, text: "\n" }];
        case "strong":
          return runs(nested, { ...style, bold: true }, depth + 1);
        case "em":
          return runs(nested, { ...style, italic: true }, depth + 1);
        case "del":
          return runs(nested, { ...style, strike: true }, depth + 1);
        case "codespan":
          return [{ ...style, code: true, text: token.text }];
        case "link": {
          const href = /^(https?:|mailto:)/i.test(token.href)
            ? token.href
            : undefined;
          return runs(nested, { ...style, link: href }, depth + 1);
        }
        default:
          if (nested) return runs(nested, style, depth + 1);
          return "text" in token && typeof token.text === "string"
            ? [{ ...style, text: decodeHTML(token.text).replace(/\n/g, " ") }]
            : [];
      }
    });
  }
  function font(style: Style) {
    return style.code
      ? fonts.mono
      : style.bold && style.italic
        ? fonts.boldItalic
        : style.bold
          ? fonts.bold
          : style.italic
            ? fonts.italic
            : fonts.regular;
  }
  function textRuns(
    parts: TextRun[],
    x: number,
    y: number,
    available: number,
    size = 11,
    align: "left" | "center" | "right" = "left",
  ) {
    const visible = parts.filter((part) => part.text.length > 0);
    if (!visible.length) return;
    doc.x = x;
    doc.y = y;
    visible.forEach((part, index) => {
      doc
        .font(font(part))
        .fontSize(size)
        .fillColor(part.link ? "#215c91" : "#20242b");
      const options = {
        width: available,
        lineGap: 4,
        continued: index < visible.length - 1,
        strike: !!part.strike,
        underline: !!part.link,
        link: part.link || null,
        align,
      };
      if (index === 0) doc.text(part.text, x, y, options);
      else doc.text(part.text, options);
    });
  }
  async function image(part: ImageRun, indent: number) {
    const match = /^data:image\/(png|jpeg|jpg);base64,([a-z\d+/=\s]+)$/i.exec(
      part.image,
    );
    if (!match)
      throw new Error(
        "This Markdown document contains a linked image that cannot be included. Embed it as a PNG or JPEG data URL to preserve the image.",
      );
    const data = Buffer.from(match[2], "base64");
    const raster = sharp(data, {
      limitInputPixels: 40_000_000,
      failOn: "error",
    }).rotate();
    const normalized = await raster.png().toBuffer({ resolveWithObject: true });
    const maxWidth = width - indent;
    const maxHeight = doc.page.height - 108;
    const scale = Math.min(
      1,
      maxWidth / normalized.info.width,
      maxHeight / normalized.info.height,
    );
    const w = normalized.info.width * scale,
      h = normalized.info.height * scale;
    if (doc.y + h > doc.page.height - 54) doc.addPage();
    const top = doc.y;
    doc.image(normalized.data, 54 + indent, top, { width: w, height: h });
    doc.y = top + h + 10;
    doc.x = 54 + indent;
  }
  async function paragraph(
    tokens: Token[],
    indent: number,
    style: Style = {},
    size = 11,
    prefix = "",
  ) {
    const parts: Run[] = [
      ...(prefix ? [{ text: prefix }] : []),
      ...runs(tokens, style),
    ];
    let pending: TextRun[] = [];
    const flush = () => {
      if (!pending.length) return;
      textRuns(pending, 54 + indent, doc.y, width - indent, size);
      doc.moveDown(0.6);
      pending = [];
    };
    for (const part of parts) {
      if ("image" in part) {
        flush();
        await image(part, indent);
      } else pending.push(part);
    }
    flush();
  }
  function table(table: Tokens.Table, indent: number) {
    const columns = table.header.length;
    if (columns > 12)
      throw new Error(
        "This Markdown table is too wide to preserve. Split it into smaller tables.",
      );
    const cellWidth = (width - indent) / columns;
    const padding = 7,
      size = 10;
    const header = table.header;
    const cellHeight = (parts: TextRun[]) => {
      let lines = 1,
        lineWidth = 0,
        lineHeight = 0;
      const available = cellWidth - 2 * padding;
      for (const part of parts) {
        doc.font(font(part)).fontSize(size);
        lineHeight = Math.max(lineHeight, doc.currentLineHeight(true));
        for (const word of part.text.split(/(\n|[^\S\n]+)/).filter(Boolean)) {
          if (word === "\n") {
            lines++;
            lineWidth = 0;
            continue;
          }
          const wordWidth = doc.widthOfString(word);
          if (/^\s+$/.test(word)) {
            lineWidth += wordWidth;
            continue;
          }
          if (lineWidth && lineWidth + wordWidth > available) {
            lines++;
            lineWidth = 0;
          }
          if (wordWidth <= available) lineWidth += wordWidth;
          else
            for (const character of word) {
              const characterWidth = doc.widthOfString(character);
              if (lineWidth && lineWidth + characterWidth > available) {
                lines++;
                lineWidth = 0;
              }
              lineWidth += characterWidth;
            }
        }
      }
      return lines * ((lineHeight || size * 1.2) + 4) + 2 * padding;
    };
    const drawRow = (cells: Tokens.TableCell[], isHeader: boolean) => {
      const parts = cells.map((cell) => runs(cell.tokens, { bold: isHeader }));
      if (parts.some((cell) => cell.some((part) => "image" in part)))
        throw new Error(
          "This Markdown table contains an image. Move images outside the table to preserve them.",
        );
      const texts = parts as TextRun[][];
      const height = Math.max(27, ...texts.map(cellHeight));
      if (height > doc.page.height - 150)
        throw new Error(
          "This Markdown table contains a row too tall to preserve. Split the row into smaller rows.",
        );
      const top = doc.y;
      cells.forEach((_cell, index) => {
        const left = 54 + indent + index * cellWidth;
        doc
          .rect(left, top, cellWidth, height)
          .fillAndStroke(isHeader ? "#edf1f4" : "#ffffff", "#aab3bc");
        textRuns(
          texts[index],
          left + padding,
          top + padding,
          cellWidth - padding * 2,
          size,
          table.align[index] || "left",
        );
      });
      doc.y = top + height;
      doc.x = 54 + indent;
    };
    const room = (cells: Tokens.TableCell[]) => {
      return Math.max(
        27,
        ...cells.map((cell) =>
          cellHeight(
            runs(cell.tokens).filter((part): part is TextRun => "text" in part),
          ),
        ),
      );
    };
    if (
      doc.y + room(header) + (table.rows[0] ? room(table.rows[0]) : 0) >
      doc.page.height - 54
    )
      doc.addPage();
    drawRow(header, true);
    for (const row of table.rows) {
      if (doc.y + room(row) > doc.page.height - 54) {
        doc.addPage();
        drawRow(header, true);
      }
      drawRow(row, false);
    }
    doc.font(fonts.regular).fontSize(11).moveDown(0.7);
  }
  async function blocks(
    tokens: Token[] = [],
    indent = 0,
    depth = 0,
    prefix = "",
  ) {
    if (depth > 20 || width - indent < 100)
      throw new Error("This Markdown document is nested too deeply.");
    for (const token of tokens) {
      switch (token.type) {
        case "heading":
          if (doc.y > doc.page.height - 140) doc.addPage();
          await paragraph(
            token.tokens || [],
            indent,
            { bold: true },
            [26, 22, 17, 14, 12, 11][token.depth - 1],
            prefix,
          );
          prefix = "";
          break;
        case "paragraph":
        case "text":
          await paragraph(
            token.tokens || marked.Lexer.lexInline(token.text),
            indent,
            {},
            11,
            prefix,
          );
          prefix = "";
          break;
        case "code":
          doc
            .font(fonts.mono)
            .fontSize(9)
            .fillColor("#20242b")
            .text(token.text.replace(/\t/g, "    "), 54 + indent + 12, doc.y, {
              width: width - indent - 12,
              lineGap: 4,
            });
          doc.moveDown(0.7);
          break;
        case "blockquote":
          await blocks(token.tokens, indent + 16, depth + 1, prefix);
          prefix = "";
          break;
        case "list": {
          const list = token as Tokens.List;
          for (const [index, item] of list.items.entries()) {
            const marker = item.task
              ? item.checked
                ? "[x] "
                : "[ ] "
              : list.ordered
                ? `${Number(list.start) + index}. `
                : "• ";
            await blocks(item.tokens, indent + 16, depth + 1, marker);
          }
          break;
        }
        case "table":
          table(token as Tokens.Table, indent);
          break;
        case "html":
          runs([token]);
          break;
        case "hr":
          doc
            .moveTo(54 + indent, doc.y)
            .lineTo(54 + width, doc.y)
            .strokeColor("#aab3bc")
            .stroke();
          doc.moveDown();
          break;
      }
    }
  }
  try {
    if (path.extname(input.inputPath).toLowerCase() === ".txt") {
      doc
        .font(fonts.mono)
        .fontSize(11)
        .fillColor("#20242b")
        .text((text || "(empty document)").replace(/\t/g, "    "), {
          lineGap: 4,
        });
    } else await blocks(marked.lexer(text));
    doc.end();
    await result;
  } catch (error) {
    doc.destroy(error as Error);
    await result.catch(() => {});
    await fs.rm(input.outputPath, { force: true });
    throw error;
  }
  await input.onProgress(95);
}
