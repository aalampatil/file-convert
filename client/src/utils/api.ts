import type { Job, SupportedFormatsResponse } from "./types";

const envBase = import.meta.env.VITE_API_URL as string | undefined;
const baseUrl = (envBase || "http://localhost:5175").replace(/\/+$/, "");

export const api = {
  baseUrl,
  async getFormats(): Promise<SupportedFormatsResponse> {
    const res = await fetch(`${baseUrl}/api/formats`);
    if (!res.ok) throw new Error("formats_failed");
    return res.json();
  },
  async createJob(input: { file: File; targetFormat: string }): Promise<Job> {
    const fd = new FormData();
    fd.append("file", input.file);
    fd.append("targetFormat", input.targetFormat);
    const res = await fetch(`${baseUrl}/api/jobs`, { method: "POST", body: fd });
    if (!res.ok) throw new Error("create_job_failed");
    return res.json();
  },
  downloadUrl(jobId: string) {
    return `${baseUrl}/api/jobs/${jobId}/download`;
  }
};

