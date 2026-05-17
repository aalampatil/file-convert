export type JobStatus = "queued" | "processing" | "finished" | "failed";

export type JobRecord = {
  id: string;
  createdAt: string;
  originalName: string;
  uploadPath: string;
  targetFormat: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: {
    outputPath: string;
    outputName: string;
    conversion: "sharp" | "pdfkit" | "fallback";
  };
};

