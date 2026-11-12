import { useRef, useState } from "react";
import { Icon } from "./Icon";
export function formatSize(bytes: number) { return bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1).replace(".0", "")} MB`; }
export function FileDrop({ file, onFile, inputs, maxBytes, disabled }: {
  file: File | null; onFile: (file: File | null) => void; inputs: string[]; maxBytes: number; disabled: boolean;
}) {
  const input = useRef<HTMLInputElement>(null); const depth = useRef(0);
  const [active, setActive] = useState(false); const [error, setError] = useState("");
  function select(files: FileList | null) {
    setError(""); if (disabled || !files?.length) return;
    if (files.length > 1) { setError("Please choose one file at a time."); return; }
    const candidate = files[0]; const ext = candidate.name.split(".").pop()?.toLowerCase() || "";
    if (!inputs.includes(ext)) { setError(`Choose a ${inputs.map(x => "." + x).join(", ")} file for this converter.`); return; }
    if (candidate.size > maxBytes) { setError(`Choose a file smaller than ${formatSize(maxBytes)}.`); return; }
    if (!candidate.size) { setError("This file is empty. Choose another file."); return; }
    onFile(candidate);
  }
  return <><div className={`dropzone ${active ? "drag-active" : ""} ${file ? "has-file" : ""}`}
    onDragEnter={e => { e.preventDefault(); depth.current++; if (!disabled) setActive(true); }}
    onDragOver={e => e.preventDefault()} onDragLeave={e => { e.preventDefault(); if (--depth.current <= 0) { depth.current = 0; setActive(false); } }}
    onDrop={e => { e.preventDefault(); depth.current = 0; setActive(false); select(e.dataTransfer.files); }}>
    {file ? <><span className="upload-icon selected-icon"><Icon name="file" size={30} /></span><strong className="selected-name" title={file.name}>{file.name}</strong><p>{formatSize(file.size)} <span className="meta-divider">/</span> Ready to convert</p><button className="text-button" disabled={disabled} onClick={() => { onFile(null); setError(""); }}>Choose a different file</button></> :
    <><span className="upload-icon"><Icon name="upload" size={28} /></span><h3>{active ? "Drop it here. We are ready." : "Give your file a fresh start."}</h3><p>Drag and drop your file here, or browse from your device.</p><button className="choose-button" disabled={disabled} onClick={() => input.current?.click()}><Icon name="file" size={17} /> Choose file <span>+</span></button><small>{inputs.map(x => x.toUpperCase()).join(", ")} <span className="meta-divider">·</span> Up to {formatSize(maxBytes)}</small></>}
    <input ref={input} className="sr-only" tabIndex={-1} aria-label="Choose file to convert" type="file" accept={inputs.map(x => "." + x).join(",")} disabled={disabled} onChange={e => { select(e.target.files); e.target.value = ""; }} />
  </div>{error ? <p className="error-message" role="alert">{error}</p> : null}</>;
}
