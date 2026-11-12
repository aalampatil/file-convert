import type { Job, SupportedFormatsResponse } from "./types";
const base = ((import.meta.env.VITE_API_URL as string | undefined) || "").replace(/\/+$/, "");
async function read<T>(response: Response): Promise<T> {
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw Object.assign(new Error(data.message || "The request failed. Please try again."), { status: response.status }); }
  return response.json();
}
export const api = {
  async getFormats(signal?: AbortSignal): Promise<SupportedFormatsResponse> { return read(await fetch(`${base}/api/formats`, { signal })); },
  async getJob(id: string, signal?: AbortSignal): Promise<Job> { return read(await fetch(`${base}/api/jobs/${encodeURIComponent(id)}`, { signal })); },
  createJob(input: { file: File; targetFormat: string; onProgress: (value: number) => void }): Promise<Job> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest(); xhr.open("POST", `${base}/api/jobs`); xhr.timeout = 120000;
      xhr.upload.onprogress = e => { if (e.lengthComputable) input.onProgress(Math.round(e.loaded / e.total * 100)); };
      xhr.onerror = () => reject(new Error("Could not reach the converter. Check your connection and try again."));
      xhr.ontimeout = () => reject(new Error("The upload timed out. Please try a smaller file."));
      xhr.onabort = () => reject(new Error("The upload was cancelled."));
      xhr.onload = () => {
        try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(data.message || "The upload failed. Please try again.")); }
        catch { reject(new Error("The server returned an unexpected response. Please try again.")); }
      };
      const form = new FormData(); form.append("file", input.file); form.append("targetFormat", input.targetFormat); xhr.send(form);
    });
  },
  downloadUrl(id: string) { return `${base}/api/jobs/${encodeURIComponent(id)}/download`; }
};
