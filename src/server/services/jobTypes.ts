export type JobStatus = "queued" | "processing" | "finished" | "failed";
export type ConversionEngine =
  "sharp" | "pdfkit" | "libreoffice" | "pdfjs" | "pdf2docx";
export type JobRecord = {
  id: string;
  createdAt: string;
  expiresAt: string;
  originalName: string;
  uploadPath: string;
  targetFormat: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: {
    outputPath: string;
    outputName: string;
    conversion: ConversionEngine;
  };
};
export function publicJob(job: JobRecord) {
  const { result } = job;
  return {
    id: job.id,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt,
    originalName: job.originalName,
    targetFormat: job.targetFormat,
    status: job.status,
    progress: job.progress,
    message: job.message,
    result: result
      ? { outputName: result.outputName, conversion: result.conversion }
      : undefined,
  };
}
