import { useEffect, useMemo, useRef, useState } from "react";

type TearableOverlayProps = {
  onDone?: () => void;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function TearableOverlay({ onDone }: TearableOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startProgressRef = useRef(0);
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);

  const edge = useMemo(() => {
    const rand = mulberry32(1337);
    const samples = 140;
    const values = new Array(samples).fill(0).map(() => (rand() - 0.5) * 2);
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 1; i < values.length - 1; i++) values[i] = (values[i - 1] + values[i] + values[i + 1]) / 3;
    }
    return values;
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const canvas2: HTMLCanvasElement = canvasEl;
    const ctx2: CanvasRenderingContext2D = ctx;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      canvas2.width = Math.floor(window.innerWidth * dpr);
      canvas2.height = Math.floor(window.innerHeight * dpr);
      canvas2.style.width = `${window.innerWidth}px`;
      canvas2.style.height = `${window.innerHeight}px`;
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      const paper = ctx.createLinearGradient(0, 0, 0, h);
      paper.addColorStop(0, "rgba(255,255,255,0.10)");
      paper.addColorStop(1, "rgba(255,255,255,0.06)");
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      for (let i = 0; i < 1200; i++) {
        const x = (i * 97) % w;
        const y = (i * 57) % h;
        ctx.fillRect(x, y, 1, 1);
      }
      ctx.globalAlpha = 1;

      const p = clamp01(progress);
      if (p > 0) {
        const baseX = p * w;
        const amplitude = Math.min(42, w * 0.06);

        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(baseX, 0);

        for (let i = 0; i < edge.length; i++) {
          const t = i / (edge.length - 1);
          const y = t * h;
          const n = edge[i];
          const x = baseX + n * amplitude;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(baseX, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "rgba(255,255,255,0.20)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(baseX, 0);
        for (let i = 0; i < edge.length; i++) {
          const t = i / (edge.length - 1);
          const y = t * h;
          const n = edge[i];
          const x = baseX + n * amplitude;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();
      }

      rafRef.current = window.requestAnimationFrame(draw);
    };

    rafRef.current = window.requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [edge, progress]);

  useEffect(() => {
    if (progress < 0.96 || fadingOut) return;
    setFadingOut(true);
    const t = window.setTimeout(() => onDone?.(), 260);
    return () => window.clearTimeout(t);
  }, [fadingOut, onDone, progress]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerDownRef.current = true;
    startXRef.current = e.clientX;
    startProgressRef.current = progress;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!pointerDownRef.current) return;
    const dx = e.clientX - startXRef.current;
    const w = window.innerWidth || 1;
    setProgress(clamp01(startProgressRef.current + dx / w));
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    pointerDownRef.current = false;
    (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
    setProgress((p) => (p < 0.18 ? 0 : p));
  }

  return (
    <div className={`tearOverlay ${fadingOut ? "tearOverlayFade" : ""}`}>
      <canvas
        ref={canvasRef}
        className="tearCanvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div className="tearHint">
        <div className="tearTitle">Tear to enter</div>
        <div className="tearSub">Drag → to peel the sheet away</div>
      </div>
      <button
        className="tearSkip"
        type="button"
        onClick={() => {
          setProgress(1);
        }}
      >
        Skip
      </button>
    </div>
  );
}
