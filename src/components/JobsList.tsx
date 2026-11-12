import type { Job } from "@/lib/types";
import { api } from "@/lib/api";
import { Icon } from "./Icon";
export function JobsList({
  jobs,
  onDismiss,
}: {
  jobs: Job[];
  onDismiss: (id: string) => void;
}) {
  if (!jobs.length)
    return (
      <div className="empty-jobs">
        <span className="empty-icon">
          <Icon name="file" size={23} />
        </span>
        <div>
          <strong>Your next chapter starts here.</strong>
          <p>Converted files will appear here, ready to download.</p>
        </div>
        <span className="empty-dash">—</span>
      </div>
    );
  return (
    <div className="job-list">
      {jobs.map((job) => {
        const done = job.status === "finished",
          failed = job.status === "failed";
        const label = done
          ? "Ready"
          : failed
            ? "Failed"
            : job.status === "queued"
              ? "Queued"
              : "Converting";
        return (
          <article className="job-row" key={job.id}>
            <span className={`job-file-icon ${failed ? "failed-icon" : ""}`}>
              <Icon name="file" size={24} />
            </span>
            <div className="job-detail">
              <strong title={job.originalName}>{job.originalName}</strong>
              <p>
                {job.targetFormat.toUpperCase()} <span>·</span>{" "}
                {job.message || label}
              </p>
              {!done && !failed ? (
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label={`Converting ${job.originalName}`}
                  aria-valuenow={job.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div style={{ width: `${job.progress}%` }} />
                </div>
              ) : null}
            </div>
            <span className={`status-label status-${job.status}`}>
              {done ? <Icon name="check" size={13} /> : null}
              {label}
            </span>
            {done ? (
              <a
                className="download-button"
                href={api.downloadUrl(job.id)}
                aria-label={`Download ${job.result?.outputName || job.originalName}`}
              >
                <Icon name="download" size={17} />
                <span>Download</span>
              </a>
            ) : null}
            {done || failed ? (
              <button
                className="icon-button dismiss-job"
                title="Remove from this list"
                aria-label={`Remove ${job.originalName} from the list`}
                onClick={() => onDismiss(job.id)}
              >
                <Icon name="close" size={16} />
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
