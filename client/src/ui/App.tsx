import { useEffect, useMemo, useState } from "react";

import { api } from "../utils/api";
import type { Job, SupportedFormatsResponse } from "../utils/types";
import { useJobSocket } from "../utils/useJobSocket";
import { FileDrop } from "./components/FileDrop";
import { JobsList } from "./components/JobsList";

export function App() {
  const [formats, setFormats] = useState<SupportedFormatsResponse | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("png");
  const [jobs, setJobs] = useState<Job[]>([]);
  const socket = useJobSocket();

  useEffect(() => {
    api.getFormats().then(setFormats).catch(() => setFormats(null));
  }, []);

  const outputOptions = useMemo(() => {
    const fromApi = formats?.groups.flatMap((g) => g.outputs).filter((x) => x !== "*");
    const unique = Array.from(new Set(fromApi || ["png", "jpg", "webp", "pdf"]));
    return unique.sort();
  }, [formats]);

  useEffect(() => {
    if (!socket) return;
    const handler = (evt: { jobId: string; status: Job["status"]; progress: number; message?: string }) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === evt.jobId ? { ...j, status: evt.status, progress: evt.progress, message: evt.message } : j))
      );
    };
    socket.on("job:update", handler);
    return () => {
      socket.off("job:update", handler);
    };
  }, [socket]);

  async function onFile(file: File) {
    const created = await api.createJob({ file, targetFormat: selectedFormat });
    setJobs((prev) => [created, ...prev]);
    socket?.emit("jobs:subscribe", { jobId: created.id });
  }

  return (
    <>
      <div className="nav">
        <div className="navInner">
          <a className="brand" href="/">
            <span className="logoMark" aria-hidden />
            <span>AcidConvert</span>
          </a>
          <div className="navLinks">
            <a href="#converter">Converter</a>
            <a href="#formats">Formats</a>
          </div>
        </div>
      </div>

      <div className="container">
        <section className="hero">
          <div className="heroGrid">
            <div>
              <h1 className="headline">Convert files with live progress.</h1>
              <p className="subhead">
                A CloudConvert-style demo built with MERN + TypeScript. Upload a file, pick an output format, and download the
                result. Supported conversions run locally on the server.
              </p>
            </div>

            <div id="formats" className="card sideCard">
              <h3 className="sideTitle">Supported formats</h3>
              <p className="sideText">Quick overview of what this demo converts server-side.</p>
              {(formats?.groups ?? []).map((g) => (
                <div key={g.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>{g.title}</div>
                  <div>
                    {g.outputs[0] === "*" ? (
                      <span className="pill">
                        <span className="pillDot" /> Fallback
                      </span>
                    ) : (
                      g.outputs.map((o) => (
                        <span key={o} className="pill">
                          <span className="pillDot" /> {o.toUpperCase()}
                        </span>
                      ))
                    )}
                  </div>
                  {g.note ? <div className="sideText">{g.note}</div> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="converter" className="card converter">
          <div className="row">
            <FileDrop onFile={onFile} />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Convert to</div>
              <select className="select" value={selectedFormat} onChange={(e) => setSelectedFormat(e.target.value)}>
                {outputOptions.map((fmt) => (
                  <option key={fmt} value={fmt}>
                    {fmt.toUpperCase()}
                  </option>
                ))}
              </select>
              <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 10 }}>
                Tip: Images support PNG/JPG/WEBP; TXT supports PDF.
              </div>
            </div>
          </div>

          <div className="card jobs">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 900, letterSpacing: -0.2 }}>Jobs</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>
                API: <span style={{ color: "rgba(240,240,240,.85)" }}>{api.baseUrl}</span>
              </div>
            </div>
            <JobsList jobs={jobs} />
          </div>
        </section>
      </div>
    </>
  );
}

