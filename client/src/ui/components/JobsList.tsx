import type { Job } from "../../utils/types";

import { api } from "../../utils/api";

function statusLabel(status: Job["status"]) {
  if (status === "queued") return "Queued";
  if (status === "processing") return "Converting…";
  if (status === "finished") return "Finished";
  return "Failed";
}

export function JobsList(props: { jobs: Job[] }) {
  if (props.jobs.length === 0) {
    return <div style={{ color: "var(--muted)", fontSize: 13, padding: "12px 0" }}>No jobs yet. Upload a file to start.</div>;
  }

  return (
    <div>
      {props.jobs.map((j) => (
        <div className="jobRow" key={j.id}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="jobName" title={j.originalName}>
              {j.originalName}
            </div>
            <div className="jobMeta">
              {statusLabel(j.status)} • {Math.round(j.progress)}%{j.message ? ` • ${j.message}` : ""}
              {j.result?.conversion === "fallback" ? " • fallback" : ""}
            </div>
            <div className="bar">
              <div className="barFill" style={{ width: `${Math.max(0, Math.min(100, j.progress))}%` }} />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {j.status === "finished" ? (
              <a className="btn" href={api.downloadUrl(j.id)}>
                Download
              </a>
            ) : null}
            {j.status === "failed" ? <span style={{ color: "var(--muted)", fontSize: 12 }}>Try again</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

