import { useRef, useState } from "react";

export function FileDrop(props: { onFile: (file: File) => Promise<void> | void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File | null | undefined) {
    if (!file || busy) return;
    setBusy(true);
    try {
      await props.onFile(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`drop ${active ? "dropActive" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => {
        e.preventDefault();
        setActive(false);
        handleFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="dropTitle">{busy ? "Uploading…" : "Drop a file here"}</div>
      <div className="dropMeta">or choose a file from your computer.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <button className="btn btnPrimary" onClick={() => inputRef.current?.click()} disabled={busy}>
          Choose file
        </button>
        <div style={{ color: "var(--muted)", fontSize: 12 }}>Max 200MB</div>
      </div>
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

