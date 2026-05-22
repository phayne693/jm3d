import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback, useEffect } from "react";
import { Upload, Download, RotateCcw, Music2, MessageCircle, ScanLine, CheckCircle2, Loader2 } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/gerador")({
  component: GeradorPage,
});

const WHATSAPP =
  "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20um%20or%C3%A7amento";

// ─── types ───────────────────────────────────────────────────────────────────
interface Settings {
  bars: number;
  radius: number;
  gap: number;
  minH: number;
  style: "bars" | "top" | "mirror" | "line";
  format: "svg" | "png-dark" | "png-white" | "png-transparent";
  waveColor: string;
  bgColor: string;
}

type MindStatus = "idle" | "loading-lib" | "compiling" | "done" | "error";

const WAVE_COLORS = [
  "#00c6e0", "#ffffff", "#e0dbd2", "#ff6b6b", "#ffd166", "#06d6a0", "#000000",
];
const BG_COLORS = [
  "#0a0a0a", "#ffffff", "#1a1a2e", "#2d1b69", "transparent",
];

const DEFAULT: Settings = {
  bars: 80,
  radius: 3,
  gap: 40,
  minH: 15,
  style: "bars",
  format: "svg",
  waveColor: "#00c6e0",
  bgColor: "#0a0a0a",
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  if (r === 0) { ctx.fillRect(x, y, w, h); return; }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.fill();
}

function drawWaveOnCanvas(
  canvas: HTMLCanvasElement,
  waveData: number[],
  s: Settings,
  W: number,
  H: number,
  overrideBg?: string,
  overrideColor?: string
) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = overrideBg ?? s.bgColor;
  if (bg === "transparent") {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  if (!waveData.length) return;

  const color = overrideColor ?? s.waveColor;
  ctx.fillStyle = color;

  const bars = waveData.length;
  const gapFrac = s.gap / 100;
  const totalBar = W / bars;
  const barW = totalBar * (1 - gapFrac);
  const barGap = totalBar * gapFrac;

  waveData.forEach((amp, i) => {
    const x = i * totalBar + barGap / 2;
    const barH = amp * H * 0.88;
    const r = s.radius;

    if (s.style === "bars" || s.style === "line") {
      roundRect(ctx, x, (H - barH) / 2, barW, barH, r);
    } else if (s.style === "top") {
      roundRect(ctx, x, H * 0.1, barW, barH * 0.8, r);
    } else if (s.style === "mirror") {
      const half = barH / 2;
      roundRect(ctx, x, H / 2 - half - 1, barW, half, r);
      roundRect(ctx, x, H / 2 + 1, barW, half, r);
    }
  });
}

// ─── slider ──────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step = 1, unit = "",
  onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-primary font-mono">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 bg-border rounded cursor-pointer"
        style={{ touchAction: "none" }}
      />
    </div>
  );
}

// ─── style preview canvas ────────────────────────────────────────────────────
function StylePreviewCanvas({
  waveData,
  settings,
  style,
}: {
  waveData: number[];
  settings: Settings;
  style: Settings["style"];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && waveData.length) {
      const W = ref.current.offsetWidth * devicePixelRatio || 200;
      drawWaveOnCanvas(ref.current, waveData, { ...settings, style }, W, 50);
    }
  }, [waveData, settings, style]);

  return (
    <canvas
      ref={ref}
      style={{ width: "100%", height: "50px", display: "block" }}
    />
  );
}

// ─── Mind AR compiler ────────────────────────────────────────────────────────
// Usa mind-ar@1.1.5 mindar-image.prod.js — bundle UMD puro sem A-Frame nem ES modules
// Expõe window.MINDAR.Image.Compiler após carregamento

async function getMindARCompiler(): Promise<new () => any> {
  const w = window as any;
  // Tenta até 6s (60 × 100ms)
  for (let i = 0; i < 60; i++) {
    if (w.MINDAR?.IMAGE?.Compiler) return w.MINDAR.IMAGE.Compiler;
    if (w.MINDAR?.Image?.Compiler) return w.MINDAR.Image.Compiler;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(
    "Compilador Mind AR não encontrado após carregamento. Recarregue a página e tente novamente."
  );
}

// Singleton — carrega o bundle apenas uma vez por sessão
let mindARLoadPromise: Promise<void> | null = null;

async function compileMind(
  imageDataUrl: string,
  onProgress: (msg: string) => void
): Promise<Blob> {
  if (!mindARLoadPromise) {
    onProgress("Carregando compilador Mind AR…");
    mindARLoadPromise = new Promise<void>((res, rej) => {
      const s = document.createElement("script");
      // v1.1.5 mindar-image (sem aframe) — bundle UMD que expõe window.MINDAR
      s.src = "https://cdn.jsdelivr.net/npm/mind-ar@1.1.5/dist/mindar-image.prod.js";
      s.onload = () => res();
      s.onerror = () => {
        mindARLoadPromise = null; // permite retry
        rej(new Error("Falha ao carregar Mind AR. Verifique sua conexão e tente novamente."));
      };
      document.head.appendChild(s);
    });
  }
  await mindARLoadPromise;
  // DEBUG TEMPORÁRIO — remover após identificar o namespace
  console.log("window keys com 'mind':", Object.keys(window).filter(k => k.toLowerCase().includes("mind")));
  console.log("window keys com 'ar':", Object.keys(window).filter(k => k.toLowerCase().includes("ar")));
  console.log("window.MINDAR:", (window as any).MINDAR);
  console.log("window.MindAR:", (window as any).MindAR);

  onProgress("Preparando imagem…");

  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Falha ao processar imagem da waveform."));
    i.src = imageDataUrl;
  });

  const tmp = document.createElement("canvas");
  tmp.width = img.width;
  tmp.height = img.height;
  tmp.getContext("2d")!.drawImage(img, 0, 0);

  const Compiler = await getMindARCompiler();
  const compiler = new Compiler();

  onProgress("Compilando… 0%");
  await compiler.compileImageTargets([tmp], (p: number) => {
    onProgress(`Compilando… ${Math.round(p * 100)}%`);
  });

  onProgress("Exportando arquivo .mind…");
  const exportedBuffer = await compiler.exportData();
  return new Blob([exportedBuffer], { type: "application/octet-stream" });
}

// ─── helpers de extração ─────────────────────────────────────────────────────
function extractWaveData(raw: Float32Array, bars: number, minH: number): number[] {
  const step = Math.max(1, Math.floor(raw.length / bars));
  const data: number[] = [];
  for (let i = 0; i < bars; i++) {
    let sum = 0;
    for (let j = 0; j < step; j++) sum += Math.abs(raw[i * step + j] ?? 0);
    data.push(sum / step);
  }
  const max = Math.max(...data) || 1;
  return data.map(v => Math.max(minH / 100, v / max));
}

// ─── main component ──────────────────────────────────────────────────────────
function GeradorPage() {
  const [s, setS] = useState<Settings>(DEFAULT);
  const [waveData, setWaveData] = useState<number[]>([]);
  const [fileName, setFileName] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState<{ msg: string; ok?: boolean } | null>(null);
  const [mindStatus, setMindStatus] = useState<MindStatus>("idle");
  const [mindMsg, setMindMsg] = useState("");
  const [mindProgress, setMindProgress] = useState(0);

  const previewRef = useRef<HTMLCanvasElement>(null);
  const chaveiroRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawAudioRef = useRef<Float32Array | null>(null);

  const set = (partial: Partial<Settings>) =>
    setS(prev => ({ ...prev, ...partial }));

  const redraw = useCallback((data: number[], settings: Settings) => {
    if (previewRef.current) {
      const W = previewRef.current.offsetWidth * devicePixelRatio || 800;
      drawWaveOnCanvas(previewRef.current, data, settings, W, 200);
    }

    if (chaveiroRef.current) {
      const CW = 520, CH = 160;
      chaveiroRef.current.width = CW;
      chaveiroRef.current.height = CH;
      const ctx = chaveiroRef.current.getContext("2d")!;
      ctx.save();

      const pad = 10, rx = 14;

      // build chaveiro rounded-rect path
      const buildPath = () => {
        ctx.beginPath();
        ctx.moveTo(pad + rx, pad);
        ctx.lineTo(CW - pad - rx, pad);
        ctx.quadraticCurveTo(CW - pad, pad, CW - pad, pad + rx);
        ctx.lineTo(CW - pad, CH - pad - rx);
        ctx.quadraticCurveTo(CW - pad, CH - pad, CW - pad - rx, CH - pad);
        ctx.lineTo(pad + rx, CH - pad);
        ctx.quadraticCurveTo(pad, CH - pad, pad, CH - pad - rx);
        ctx.lineTo(pad, pad + rx);
        ctx.quadraticCurveTo(pad, pad, pad + rx, pad);
        ctx.closePath();
      };

      // fill body
      ctx.fillStyle = settings.bgColor === "transparent" ? "#1a1a1a" : settings.bgColor;
      buildPath();
      ctx.fill();

      // clip so wave never overflows edges
      buildPath();
      ctx.clip();

      if (data.length) {
        const holeEndX = pad + 42;
        const wavePad = 10;
        const leftX = holeEndX + wavePad;
        const rightX = CW - pad - wavePad;
        const wW = rightX - leftX;
        const wH = CH - pad * 2 - 10;
        const tmp = document.createElement("canvas");
        drawWaveOnCanvas(tmp, data, settings, wW, wH, "transparent");
        ctx.drawImage(tmp, leftX, pad + 5);
      }

      ctx.restore();

      // hole drawn after restore so clip doesn't affect it
      ctx.beginPath();
      ctx.arc(pad + 22, CH / 2, 8, 0, Math.PI * 2);
      ctx.fillStyle = "#060606";
      ctx.fill();
      ctx.strokeStyle = "#444";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    setMindStatus("idle");
  }, []);

  const update = (partial: Partial<Settings>) => {
    const next = { ...s, ...partial };
    set(partial);
    redraw(waveData, next);
  };

  const reExtract = (partial: Partial<Settings>) => {
    const next = { ...s, ...partial };
    set(partial);
    if (!rawAudioRef.current) return;
    const newData = extractWaveData(rawAudioRef.current, next.bars, next.minH);
    setWaveData(newData);
    redraw(newData, next);
  };

  const handleFile = async (file: File) => {
    setStatus({ msg: "Analisando áudio…" });
    setFileName(file.name);
    setMindStatus("idle");

    try {
      const arrayBuf = await file.arrayBuffer();
      const audioCtx = new AudioContext();
      const buffer = await audioCtx.decodeAudioData(arrayBuf);
      await audioCtx.close();

      const mins = Math.floor(buffer.duration / 60);
      const secs = Math.floor(buffer.duration % 60).toString().padStart(2, "0");
      setDuration(`${mins}:${secs}`);

      const raw = buffer.getChannelData(0);
      rawAudioRef.current = raw;
      const normalized = extractWaveData(raw, s.bars, s.minH);
      setWaveData(normalized);
      redraw(normalized, s);
      setStatus({ msg: "Waveform gerada com sucesso ✓", ok: true });
    } catch {
      setStatus({ msg: "Erro ao decodificar o áudio.", ok: false });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const exportWave = () => {
    if (!waveData.length) return;

    if (s.format === "svg") {
      const W = 500, H = 100;
      const bars = waveData.length;
      const gapFrac = s.gap / 100;
      const totalBar = W / bars;
      const barW = totalBar * (1 - gapFrac);
      const barGap = totalBar * gapFrac;
      const bg = s.bgColor === "transparent" ? "none" : s.bgColor;

      let rects = "";
      waveData.forEach((amp, i) => {
        const x = i * totalBar + barGap / 2;
        const barH = amp * H * 0.88;
        const r = Math.min(s.radius, barW / 2, barH / 2);
        const getRect = (y: number, h: number) =>
          `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${s.waveColor}"/>`;

        if (s.style === "bars" || s.style === "line") {
          rects += getRect((H - barH) / 2, barH);
        } else if (s.style === "top") {
          rects += getRect(H * 0.1, barH * 0.8);
        } else if (s.style === "mirror") {
          const half = barH / 2;
          rects += getRect(H / 2 - half - 1, half);
          rects += getRect(H / 2 + 1, half);
        }
      });

      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">\n  <rect width="${W}" height="${H}" fill="${bg}"/>\n  ${rects}\n</svg>`;
      downloadBlob("jm3d-waveform.svg", new Blob([svg], { type: "image/svg+xml" }));
      setStatus({ msg: "SVG exportado! Importe no seu slicer 3D ✓", ok: true });
      return;
    }

    const c = document.createElement("canvas");
    const isWhite = s.format === "png-white";
    const isTrans = s.format === "png-transparent";
    drawWaveOnCanvas(
      c, waveData, s, 1000, 200,
      isTrans ? "transparent" : isWhite ? "#ffffff" : undefined,
      isWhite ? "#000000" : undefined
    );
    c.toBlob(blob => {
      if (!blob) return;
      downloadBlob("jm3d-waveform.png", blob);
      setStatus({ msg: "PNG exportado com sucesso ✓", ok: true });
    }, "image/png");
  };

  // ── Gerar .mind ─────────────────────────────────────────────────────────────
  const generateMind = async () => {
    if (!waveData.length || !previewRef.current) return;

    setMindStatus("loading-lib");
    setMindMsg("Iniciando…");
    setMindProgress(0);

    try {
      const exportCanvas = document.createElement("canvas");
      drawWaveOnCanvas(exportCanvas, waveData, s, 1200, 300);
      const dataUrl = exportCanvas.toDataURL("image/png");

      setMindStatus("compiling");

      const blob = await compileMind(dataUrl, (msg) => {
        setMindMsg(msg);
        const match = msg.match(/(\d+)%/);
        if (match) setMindProgress(Number(match[1]));
      });

      downloadBlob("waveform.mind", blob);
      setMindStatus("done");
      setMindMsg("waveform.mind baixado! Coloque em public/targets/ e faça o deploy.");
    } catch (err: any) {
      setMindStatus("error");
      setMindMsg(err?.message || "Erro ao compilar o target.");
    }
  };

  function downloadBlob(name: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  const reset = () => {
    setS(DEFAULT);
    setWaveData([]);
    setFileName("");
    setDuration("");
    setStatus(null);
    setMindStatus("idle");
    setMindMsg("");
    rawAudioRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (previewRef.current) {
      const ctx = previewRef.current.getContext("2d")!;
      ctx.clearRect(0, 0, previewRef.current.width, previewRef.current.height);
    }
  };

  const isCompiling = mindStatus === "loading-lib" || mindStatus === "compiling";

  return (
    <div className="dark min-h-dvh bg-background">

      <header className="border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between pt-safe">
        <a href="/" className="min-h-[44px] flex items-center">
          <img src={logo} alt="JM3D" className="h-10 w-auto" />
        </a>
        <a
          href={WHATSAPP} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium hover:bg-primary/20 transition min-h-[44px]"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Solicitar Orçamento</span>
          <span className="sm:hidden">Orçamento</span>
        </a>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6 sm:gap-8 pb-safe">

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            Gerador de <span className="text-gradient">Waveform</span>
          </h1>
          <p className="mt-2 text-muted-foreground text-sm">
            Faça upload do áudio do cliente e exporte a waveform para o seu projeto 3D.
          </p>
        </div>

        {/* upload */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          className="glass rounded-2xl border-2 border-dashed border-border hover:border-primary/60 transition cursor-pointer p-6 sm:p-10 text-center group min-h-[120px] flex flex-col items-center justify-center"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition">
            {fileName ? <Music2 className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
          </div>
          {fileName ? (
            <>
              <p className="font-medium text-sm text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">{duration} · clique para trocar</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Arraste o áudio ou <span className="text-primary">clique para selecionar</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">MP3 · WAV · OGG · M4A · FLAC</p>
            </>
          )}
        </div>

        {status && (
          <p className={`text-xs font-mono ${status.ok === true ? "text-primary" : status.ok === false ? "text-red-400" : "text-muted-foreground"}`}>
            {status.msg}
          </p>
        )}

        {/* settings */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Configurações</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Slider label="Barras" value={s.bars} min={30} max={200}
              onChange={v => reExtract({ bars: v })} />
            <Slider label="Arredondamento" value={s.radius} min={0} max={10}
              onChange={v => update({ radius: v })} />
            <Slider label="Espaçamento" value={s.gap} min={10} max={70} unit="%"
              onChange={v => update({ gap: v })} />
            <Slider label="Altura mínima" value={s.minH} min={2} max={30} unit="%"
              onChange={v => reExtract({ minH: v })} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Estilo</span>
              <select
                value={s.style}
                onChange={e => update({ style: e.target.value as Settings["style"] })}
                className="rounded-xl border border-border bg-card text-base sm:text-sm px-3 py-2.5 sm:py-2 text-foreground focus:outline-none focus:border-primary min-h-[44px] sm:min-h-0"
              >
                <option value="bars">Barras simétricas</option>
                <option value="top">Barras topo</option>
                <option value="mirror">Espelho</option>
                <option value="line">Linha contínua</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Formato de exportação</span>
              <select
                value={s.format}
                onChange={e => set({ format: e.target.value as Settings["format"] })}
                className="rounded-xl border border-border bg-card text-base sm:text-sm px-3 py-2.5 sm:py-2 text-foreground focus:outline-none focus:border-primary min-h-[44px] sm:min-h-0"
              >
                <option value="svg">SVG — para slicer 3D</option>
                <option value="png-dark">PNG — fundo escuro</option>
                <option value="png-white">PNG — fundo branco</option>
                <option value="png-transparent">PNG — transparente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Cor da onda</span>
              <div className="flex gap-2 flex-wrap">
                {WAVE_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => update({ waveColor: c })}
                    style={{ background: c }}
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-lg sm:rounded-md border transition hover:scale-110 ${s.waveColor === c ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Fundo</span>
              <div className="flex gap-2 flex-wrap">
                {BG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => update({ bgColor: c })}
                    style={
                      c === "transparent"
                        ? { backgroundImage: "repeating-conic-gradient(#555 0% 25%, #222 0% 50%)", backgroundSize: "10px 10px" }
                        : { background: c }
                    }
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-lg sm:rounded-md border transition hover:scale-110 ${s.bgColor === c ? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* preview wave */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Preview — Waveform</h2>
          <div className="rounded-xl overflow-hidden border border-border">
            <canvas ref={previewRef} style={{ width: "100%", height: "100px", display: "block" }} />
          </div>
        </div>

        {/* comparação de estilos */}
        {waveData.length > 0 && (
          <div className="glass rounded-2xl p-6 flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Comparação de estilos
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(["bars", "top", "mirror", "line"] as const).map((styleOpt) => (
                <button
                  key={styleOpt}
                  onClick={() => update({ style: styleOpt })}
                  className={`flex flex-col gap-1.5 rounded-xl border p-2 transition cursor-pointer ${
                    s.style === styleOpt
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <StylePreviewCanvas waveData={waveData} settings={s} style={styleOpt} />
                  <span className="text-xs text-center text-muted-foreground capitalize">{styleOpt}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* preview chaveiro */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Preview — Chaveiro</h2>
          <div className="flex justify-center rounded-xl bg-[#141414] border border-border p-6">
            <canvas ref={chaveiroRef} style={{ maxWidth: "100%", borderRadius: "8px" }} />
          </div>
        </div>

        {/* ── Painel Mind AR ─────────────────────────────────────────────────── */}
        {waveData.length > 0 && (
          <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-primary/10">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <ScanLine className="h-4 w-4 text-primary" />
                Target AR — Reconhecimento por Câmera
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-md">
                Gera o arquivo <span className="text-foreground font-mono">.mind</span> que permite
                o celular reconhecer a waveform impressa e abrir o player automaticamente.
                Coloque o arquivo em{" "}
                <span className="text-primary font-mono">public/targets/waveform.mind</span> após baixar.
              </p>
            </div>

            {/* barra de progresso */}
            {isCompiling && (
              <div className="flex flex-col gap-2">
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{
                      width: mindProgress ? `${mindProgress}%` : "30%",
                      animation: mindProgress ? "none" : "indeterminate 1.5s ease-in-out infinite",
                    }}
                  />
                </div>
                <p className="text-xs font-mono text-muted-foreground">{mindMsg}</p>
                <style>{`
                  @keyframes indeterminate {
                    0%   { margin-left: 0%;   width: 30%; }
                    50%  { margin-left: 35%;  width: 40%; }
                    100% { margin-left: 100%; width: 10%; }
                  }
                `}</style>
              </div>
            )}

            {mindStatus === "done" && (
              <div className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">waveform.mind baixado!</span>
                  {" "}Coloque em <span className="text-primary font-mono">public/targets/</span> e rode o{" "}
                  <span className="text-primary font-mono">deploy.ps1</span>.
                </div>
              </div>
            )}

            {mindStatus === "error" && (
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3 text-xs text-red-400">
                {mindMsg}
              </div>
            )}

            <button
              onClick={generateMind}
              disabled={isCompiling || !waveData.length}
              className="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-base sm:text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]"
            >
              {isCompiling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mindStatus === "loading-lib" ? "Carregando…" : "Compilando…"}
                </>
              ) : mindStatus === "done" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Gerar novamente
                </>
              ) : (
                <>
                  <ScanLine className="h-4 w-4" />
                  Gerar .mind para AR
                </>
              )}
            </button>
          </div>
        )}

        {/* actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={exportWave}
            disabled={!waveData.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/40 px-6 py-3 text-base sm:text-sm font-medium hover:bg-primary/20 transition disabled:opacity-30 disabled:cursor-not-allowed glow-border min-h-[44px]"
          >
            <Download className="h-4 w-4 text-primary" />
            Exportar Waveform
          </button>
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-base sm:text-sm font-medium hover:border-primary/40 transition min-h-[44px]"
          >
            <RotateCcw className="h-4 w-4" />
            Reiniciar
          </button>
        </div>

      </main>
    </div>
  );
}
