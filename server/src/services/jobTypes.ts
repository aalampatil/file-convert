export type JobStatus = "queued" | "processing" | "finished" | "failed";
export type ConversionEngine = "sharp" | "pdfkit" | "libreoffice" | "pdfjs";
export type JobRecord = {
  id: string; createdAt: string; expiresAt: string; originalName: string; uploadPath: string;
  targetFormat: string; status: JobStatus; progress: number; message?: string;
  result?: { outputPath: string; outputName: string; conversion: ConversionEngine };
};
export function publicJob(job: JobRecord) {
  const { uploadPath: _upload, result, ...rest } = job;
  return { ...rest, result: result ? { outputName: result.outputName, conversion: result.conversion } : undefined };
}
