export type JobStatus = "queued" | "processing" | "finished" | "failed";
export type Job = {
  id: string;
  createdAt: string;
  expiresAt: string;
  originalName: string;
  targetFormat: string;
  status: JobStatus;
  progress: number;
  message?: string;
  result?: {
    outputName: string;
    conversion: "sharp" | "pdfkit" | "libreoffice" | "pdfjs";
  };
};
export type FormatGroup = {
  id: string;
  title: string;
  inputs: string[];
  outputs: string[];
  note: string;
  available: boolean;
};
export type SupportedFormatsResponse = {
  maxUploadBytes: number;
  retentionHours: number;
  groups: FormatGroup[];
};
