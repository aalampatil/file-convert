import sharp from "sharp";

export async function convertImage(input: {
  inputPath: string;
  outputPath: string;
  targetFormat: string;
  onProgress: (p: number) => Promise<void> | void;
}) {
  const target = input.targetFormat;
  const pipeline = sharp(input.inputPath, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();

  await input.onProgress(35);

  if (target === "png") pipeline.png({ quality: 100 });
  else if (target === "jpg" || target === "jpeg") pipeline.jpeg({ quality: 92, mozjpeg: true });
  else if (target === "webp") pipeline.webp({ quality: 90 });
  else {
    throw new Error("Unsupported image output format.");
  }

  await input.onProgress(70);
  await pipeline.toFile(input.outputPath);
  await input.onProgress(95);
  return input.outputPath;
}

