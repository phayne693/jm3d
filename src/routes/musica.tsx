import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Music2, MessageCircle } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/musica")({
  component: MusicaPage,
  validateSearch: (search: Record<string, unknown>) => ({
    track: (search.track as string) || "patricia",
  }),
});

interface TrackInfo {
  name: string;
  artist: string;
  audio: string;
}

const TRACKS: Record<string, TrackInfo> = {
  patricia: {
    name: "Mensagem Especial",
    artist: "Patricia Soares",
    audio: "/audios/patricia.ogg",
  },
};

const WHATSAPP =
  "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20um%20chaveiro%20personalizado";

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function MusicaPage() {
  const { track } = useSearch({ from: "/musica" });
  const info = TRACKS[track] || TRACKS["patricia"];

  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  function drawBars() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const analyser = analyserRef.current;
    const c = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
    if (analyser) analyser.getByteFrequencyData(data);

    c.clearRect(0, 0, W, H);

    const bars = 52;
    const gap = 3;
    const bw = (W - gap * (bars - 1)) / bars;

    for (let i = 0; i < bars; i++) {
      const v = analyser
        ? data[Math.floor((i * data.length) / bars)] / 255
        : 0.05;
      const h = Math.max(4, v * H * 0.9);
      const x = i * (bw + gap);
      const y = (H - h) / 2;

      const grad = c.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, "rgba(0,140,255,0.5)");
      grad.addColorStop(0.5, "rgba(0,140,255,1)");
      grad.addColorStop(1, "rgba(0,140,255,0.5)");

      c.beginPath();
      c.roundRect(x, y, bw, h, 2);
      c.fillStyle = grad;
      c.fill();
    }

    animRef.current = requestAnimationFrame(drawBars);
  }

  async function setupAnalyser() {
    if (analyserRef.current) return;
    const audio = audioRef.current!;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    const src = ctx.createMediaElementSource(audio);
    src.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    drawBars();
  }

  async function togglePlay() {
    const audio = audioRef.current!;
    if (!analyserRef.current) await setupAnalyser();
    if (audioCtxRef.current?.state === "suspended")
      await audioCtxRef.current.resume();

    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  const progress = duration ? (current / duration) * 100 : 0;

  return (
    <div className="dark min-h-screen bg-background flex flex-col">
      {/* Header igual ao site */}
      <header className="border-b border-border/50 px-6 py-4 flex items-center justify-between">
        <a href="/">
          <img src={logo} alt="JM3D" className="h-10 w-auto object-contain" />
        </a>
        <a
          href={WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/20 hover:border-primary glow-border transition"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          Quero o meu
        </a>
      </header>

      {/* Conteúdo central */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">

          {/* Disco giratório */}
          <div className="relative">
            <div
              className="h-44 w-44 rounded-full glass border border-primary/30 glow-strong flex items-center justify-center"
              style={{
                animation: playing ? "jm3d-spin 8s linear infinite" : "none",
                background:
                  "conic-gradient(from 0deg, rgba(0,140,255,0.15), rgba(0,0,0,0), rgba(0,140,255,0.15), rgba(0,0,0,0))",
              }}
            >
              <div className="h-12 w-12 rounded-full bg-background border border-primary/20 flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary" />
              </div>
            </div>
            {playing && (
              <div
                className="absolute inset-0 rounded-full border border-primary/30"
                style={{ animation: "jm3d-ping 1.8s ease-out infinite" }}
              />
            )}
          </div>

          <style>{`
            @keyframes jm3d-spin { to { transform: rotate(360deg); } }
            @keyframes jm3d-ping {
              0% { transform: scale(1); opacity: 0.6; }
              100% { transform: scale(1.35); opacity: 0; }
            }
          `}</style>

          {/* Info da faixa */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">{info.name}</h1>
            <p className="mt-1 text-sm text-primary">{info.artist}</p>
          </div>

          {/* Visualizador ao vivo */}
          <div className="w-full glass rounded-2xl p-4 border border-primary/10">
            <canvas
              ref={canvasRef}
              width={320}
              height={60}
              className="w-full h-[60px]"
            />
          </div>

          {/* Barra de progresso */}
          <div className="w-full flex flex-col gap-2">
            <div
              className="w-full h-1 rounded-full bg-border cursor-pointer relative"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                if (audioRef.current)
                  audioRef.current.currentTime = pct * duration;
              }}
            >
              <div
                className="h-full rounded-full bg-primary transition-all relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-primary shadow-[0_0_8px_rgba(0,140,255,0.8)]" />
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(current)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Botão play */}
          <button
            onClick={togglePlay}
            disabled={!ready}
            className={`h-16 w-16 rounded-full flex items-center justify-center transition ${
              ready
                ? "bg-primary text-primary-foreground glow-strong hover:opacity-90"
                : "bg-primary/20 text-muted-foreground cursor-default"
            }`}
          >
            {playing ? (
              <Pause className="h-7 w-7" />
            ) : (
              <Play className="h-7 w-7 ml-0.5" />
            )}
          </button>

          <audio
            ref={audioRef}
            src={info.audio}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration);
              setReady(true);
            }}
            onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
            onEnded={() => setPlaying(false)}
          />

          {/* CTA */}
          <div className="w-full glass rounded-2xl p-5 border border-primary/10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Quer um chaveiro com a{" "}
              <span className="text-foreground font-medium">sua música</span>?
            </p>
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition"
            >
              <MessageCircle className="h-4 w-4" />
              Solicitar Orçamento
            </a>
          </div>

        </div>
      </main>

      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © 2026 JM3D — Imagine. Crie. Imprima.
      </footer>
    </div>
  );
}
