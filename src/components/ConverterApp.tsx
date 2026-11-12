"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Job, SupportedFormatsResponse } from "@/lib/types";
import { FileDrop, formatSize } from "./FileDrop";
import { JobsList } from "./JobsList";
import { Icon } from "./Icon";
const tools = [
  {
    id: "markdown",
    label: "Markdown to PDF",
    from: "MD",
    description: "From plain text to polished.",
    symbol: "M↓",
    color: "mint",
    inputs: ["md", "markdown"],
  },
  {
    id: "word",
    label: "Word to PDF",
    from: "DOCX",
    description: "Keep your work looking sharp.",
    symbol: "W",
    color: "blue",
    inputs: ["doc", "docx"],
  },
  {
    id: "pdf",
    label: "PDF to Word",
    from: "PDF",
    description: "Make room for your next edit.",
    symbol: "PDF",
    color: "rose",
    inputs: ["pdf"],
  },
  {
    id: "image",
    label: "Image converter",
    from: "IMG",
    description: "A new look for every image.",
    symbol: "IMG",
    color: "lavender",
    inputs: ["png", "jpg", "jpeg", "webp"],
  },
  {
    id: "text",
    label: "Text to PDF",
    from: "TXT",
    description: "Simple words. Beautiful pages.",
    symbol: "Aa",
    color: "mint",
    inputs: ["txt"],
  },
];
const sessionKey = "folio:jobs:v1";
function savedIds(): string[] {
  try {
    const data: unknown = JSON.parse(
      sessionStorage.getItem(sessionKey) || "[]",
    );
    return Array.isArray(data)
      ? data
          .filter(
            (id): id is string =>
              typeof id === "string" && /^[\w-]{32}$/.test(id),
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
export function ConverterApp() {
  const [formats, setFormats] = useState<SupportedFormatsResponse | null>(null),
    [formatsError, setFormatsError] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [toolId, setToolId] = useState("markdown"),
    [output, setOutput] = useState("pdf"),
    [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]),
    [restored, setRestored] = useState(false),
    [uploading, setUploading] = useState(false),
    [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(""),
    [connectionLost, setConnectionLost] = useState(false),
    [showMore, setShowMore] = useState(false);
  const submitting = useRef(false);
  const tool = tools.find((t) => t.id === toolId)!,
    group = formats?.groups.find((g) => g.id === toolId);
  const maxBytes = formats?.maxUploadBytes || 25 * 1048576,
    retention = formats?.retentionHours || 1;
  useEffect(() => {
    const controller = new AbortController();
    api
      .getFormats(controller.signal)
      .then(setFormats)
      .catch(() => {
        if (!controller.signal.aborted) setFormatsError(true);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled(
      savedIds().map((id) => api.getJob(id, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const loaded = results.flatMap((r) =>
        r.status === "fulfilled" ? [r.value] : [],
      );
      setJobs((prev) =>
        [
          ...prev,
          ...loaded.filter((job) => !prev.some((p) => p.id === job.id)),
        ].slice(0, 20),
      );
      setRestored(
        !results.some(
          (r) => r.status === "rejected" && r.reason?.status !== 404,
        ),
      );
    });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (restored) {
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify(jobs.map((j) => j.id).slice(0, 20)),
        );
      } catch {
        /* Optional session history. */
      }
    }
  }, [jobs, restored]);
  const pendingIds = jobs
    .filter((j) => j.status === "queued" || j.status === "processing")
    .map((j) => j.id)
    .join(",");
  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    let busy = false;
    const ids = pendingIds.split(",");
    async function refresh() {
      if (busy || document.hidden) return;
      busy = true;
      const results = await Promise.allSettled(
        ids.map((id) => api.getJob(id, controller.signal)),
      );
      busy = false;
      if (controller.signal.aborted) return;
      setConnectionLost(
        results.some(
          (r) => r.status === "rejected" && r.reason?.status !== 404,
        ),
      );
      setJobs((prev) =>
        prev.map((job) => {
          const index = ids.indexOf(job.id);
          if (index < 0) return job;
          const result = results[index];
          if (result.status === "fulfilled") return result.value;
          if (result.reason?.status === 404)
            return {
              ...job,
              status: "failed",
              progress: 100,
              message: "This conversion has expired. Upload your file again.",
            };
          return job;
        }),
      );
    }
    void refresh();
    const timer = setInterval(() => {
      void refresh();
    }, 1500);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [pendingIds]);
  function chooseTool(id: string) {
    if (uploading) return;
    setToolId(id);
    setOutput(id === "pdf" ? "docx" : id === "image" ? "png" : "pdf");
    setFile(null);
    setError("");
  }
  async function convert() {
    if (!file || submitting.current || !group?.available) return;
    submitting.current = true;
    setUploading(true);
    setUploadProgress(0);
    setError("");
    try {
      const job = await api.createJob({
        file,
        targetFormat: output,
        onProgress: setUploadProgress,
      });
      setJobs((prev) => [job, ...prev].slice(0, 20));
      setFile(null);
      try {
        sessionStorage.setItem(
          sessionKey,
          JSON.stringify([job.id, ...savedIds()].slice(0, 20)),
        );
      } catch {
        /* Optional session history. */
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The upload failed. Please try again.",
      );
    } finally {
      submitting.current = false;
      setUploading(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to converter
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Folio home">
          <span className="brand-mark">
            f<span>●</span>
          </span>
          <span>
            folio<span className="brand-period">.</span>
          </span>
        </Link>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Workspace">
          <a className="nav-item active" href="#converter">
            <Icon name="grid" size={18} />
            All converters<span className="nav-count">05</span>
          </a>
          <a className="nav-item" href="#recent">
            <Icon name="clock" size={18} />
            Recent files
            {jobs.length ? (
              <span className="nav-count">{jobs.length}</span>
            ) : null}
          </a>
          <a className="nav-item" href="#how-it-works">
            <Icon name="info" size={18} />
            How it works
          </a>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-note">
            <span className="privacy-icon">
              <Icon name="shield" size={21} />
            </span>
            <strong>Your files. Your business.</strong>
            <p>
              Files expire after {retention} hour{retention > 1 ? "s" : ""} and
              are automatically deleted.
            </p>
            <a href="#privacy">
              A little peace of mind <span>↗</span>
            </a>
          </div>
          <div className="sidebar-foot">
            <span className="tiny-logo">f.</span> Less friction. More flow.
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <span>Workspace</span>
            <Icon name="chevron" size={12} />
            <strong>All converters</strong>
          </div>
          <span className={`server-status ${formatsError ? "offline" : ""}`}>
            <i />
            {formatsError
              ? "Connection unavailable"
              : formats
                ? "Ready when you are"
                : "Connecting…"}
          </span>
        </header>
        <main id="main" className="main-content">
          <section className="intro">
            <div className="eyebrow">
              <span /> SMALL TOOL. BIG POSSIBILITIES.
            </div>
            <h1>
              A new format.
              <br />
              Same <em>good work.</em>
            </h1>
            <p>
              Move your files forward. Convert documents and images
              <br className="desktop-break" /> in a few clicks, without the
              extra steps.
            </p>
            <span className="intro-stamp" aria-hidden="true">
              <Icon name="file" size={38} />
              <span>→</span>
              <Icon name="file" size={38} />
            </span>
          </section>
          <section id="converter" aria-labelledby="converter-title">
            <div className="section-heading">
              <h2 id="converter-title">What are we working on?</h2>
              <button
                className="text-button more-tools"
                onClick={() => setShowMore((v) => !v)}
                aria-expanded={showMore}
              >
                {showMore ? "Show less" : "All 5 converters"}
                <Icon name="arrow" size={16} />
              </button>
            </div>
            <div
              className="tool-grid"
              role="group"
              aria-label="Conversion tools"
            >
              {tools.slice(0, showMore ? 5 : 3).map((t) => (
                <button
                  className={`tool-card ${t.id === toolId ? "selected" : ""}`}
                  key={t.id}
                  aria-pressed={t.id === toolId}
                  disabled={uploading}
                  onClick={() => chooseTool(t.id)}
                >
                  <span className={`format-symbol ${t.color}`}>{t.symbol}</span>
                  <span className="tool-copy">
                    <strong>{t.label}</strong>
                    <small>{t.description}</small>
                  </span>
                  <span className="tool-radio">
                    {t.id === toolId ? <span /> : null}
                  </span>
                </button>
              ))}
            </div>
            <div className="converter-card">
              <div className="converter-header">
                <div>
                  <span className="step-number">01</span>
                  <h3>{tool.label}</h3>
                  <span className="format-route">
                    {tool.from}
                    <Icon name="arrow" size={12} />
                    {output.toUpperCase()}
                  </span>
                </div>
                <span className="secure-label">
                  <Icon name="shield" size={14} />
                  Private by default
                </span>
              </div>
              <div className="converter-body">
                {formatsError ? (
                  <div className="notice error-notice" role="alert">
                    We could not reach the converter.{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        setFormatsError(false);
                        setAttempt((v) => v + 1);
                      }}
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {group && !group.available ? (
                  <div className="notice" role="status">
                    Word conversion is temporarily unavailable on this server.
                    Try another converter.
                  </div>
                ) : null}
                <FileDrop
                  key={toolId}
                  file={file}
                  onFile={(value) => {
                    setFile(value);
                    setError("");
                  }}
                  inputs={group?.inputs || tool.inputs}
                  maxBytes={maxBytes}
                  disabled={uploading}
                />
                <div className="conversion-controls">
                  <div className="output-control">
                    <label htmlFor="output-format">OUTPUT FORMAT</label>
                    <div className="output-select">
                      <span
                        className={`output-badge ${output === "docx" ? "blue" : "rose"}`}
                      >
                        {output.toUpperCase()}
                      </span>
                      <select
                        id="output-format"
                        value={output}
                        disabled={uploading}
                        onChange={(e) => setOutput(e.target.value)}
                      >
                        {(group?.outputs || [output]).map((fmt) => (
                          <option key={fmt} value={fmt}>
                            {fmt === "docx"
                              ? "Word document (.docx)"
                              : fmt === "pdf"
                                ? "PDF document (.pdf)"
                                : `${fmt.toUpperCase()} image (.${fmt})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button
                    className="convert-button"
                    disabled={
                      !file || uploading || !group?.available || formatsError
                    }
                    onClick={() => {
                      void convert();
                    }}
                  >
                    {uploading
                      ? `Uploading ${uploadProgress}%`
                      : "Convert file"}
                    <Icon name="arrow" size={19} />
                  </button>
                </div>
                {uploading ? (
                  <div
                    className="progress-track upload-progress"
                    role="progressbar"
                    aria-label="Uploading file"
                    aria-valuenow={uploadProgress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div style={{ width: `${uploadProgress}%` }} />
                  </div>
                ) : null}
                {error ? (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                ) : null}
                <p className="conversion-note">
                  <Icon name="info" size={14} />
                  {group?.note ||
                    "Choose a file, convert it, and download your result."}
                </p>
              </div>
              <div className="converter-footer">
                <span>
                  <Icon name="shield" size={14} />
                  No account needed
                </span>
                <span>
                  <Icon name="clock" size={14} />
                  Auto-deleted after {retention}h
                </span>
                <span>
                  <Icon name="file" size={14} />
                  Up to {formatSize(maxBytes)}
                </span>
              </div>
            </div>
          </section>
          <section
            id="recent"
            className="recent-section"
            aria-labelledby="recent-title"
          >
            <div className="section-heading">
              <h2 id="recent-title">
                Your recent files{" "}
                <span className="heading-count">
                  {jobs.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <span className="session-label">THIS SESSION</span>
            </div>
            <div className="recent-card">
              <JobsList
                jobs={jobs}
                onDismiss={(id) =>
                  setJobs((prev) => prev.filter((j) => j.id !== id))
                }
              />
            </div>
            {connectionLost ? (
              <p role="status" className="error-message">
                Connection interrupted. Progress will update when you reconnect.
              </p>
            ) : null}
          </section>
          <section
            id="how-it-works"
            className="benefits"
            aria-label="How it works"
          >
            <article>
              <span>01 /</span>
              <h3>A file goes in.</h3>
              <p>Choose a converter and drop in your document or image.</p>
            </article>
            <article>
              <span>02 /</span>
              <h3>A little magic happens.</h3>
              <p>We handle the conversion. You can follow its progress here.</p>
            </article>
            <article>
              <span>03 /</span>
              <h3>Your work moves on.</h3>
              <p>Download your new file. Get back to what matters.</p>
            </article>
          </section>
          <footer id="privacy" className="page-footer">
            <span>
              Made for the way you work. <strong>folio.</strong>
            </span>
            <p>
              Files are processed on this server and deleted after {retention}h.
              Keep download links private.
            </p>
            <span>Less friction. More flow. ↗</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
