export type JobStatus = "queued" | "processing" | "finished" | "failed";

export type Job = {
  id: string;
  createdAt: string;
  originalName: string;
  targetFormat: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: {
    outputName: string;
    conversion: "sharp" | "pdfkit" | "fallback";
  };
};

export type SupportedFormatsResponse = {
  groups: Array<{
    id: "image" | "text" | "other";
    title: string;
    inputExamples: string[];
    outputs: string[];
    note?: string;
  }>;
};

