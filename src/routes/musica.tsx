import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { Play, Pause, Music2, MessageCircle, Share2 } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/musica")({
  validateSearch: (s: Record<string, unknown>) => ({
    track: String(s.track ?? ""),
  }),
  component: MusicaPage,
});

const WHATSAPP = "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20minha%20mem%C3%B3ria%20sonora";

function fmt(s: number) {
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,"0")}`;
}

function roundRectPath(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w/2, h/2);
  c.moveTo(x+rr,y); c.lineTo(x+w-rr,y);
  c.quadraticCurveTo(x+w,y,x+w,y+rr);
  c.lineTo(x+w,y+h-rr);
  c.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  c.lineTo(x+rr,y+h);
  c.quadraticCurveTo(x,y+h,x,y+h-rr);
  c.lineTo(x,y+rr);
  c.quadraticCurveTo(x,y,x+rr,y);
  c.closePath();
}

function MusicaPage() {
  const { track } = useSearch({ from: "/musica" });

  const audioRef  = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const audioCtxRef  = useRef<AudioContext | null>(null);
  const lastSaveRef  = useRef<number>(0);

  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady]       = useState(false);
  const [copied, setCopied]     = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [trackNome, setTrackNome] = useState("");

  const audioSrc = track ? `/api/audio/${track}` : "";

  // Busca nome do cliente — reseta a cada mudança de track (sem cache)
  useEffect(() => {
    setTrackNome("");   // limpa antes de buscar
    setNotFound(false);
    if (!track) { setNotFound(true); return; }
    fetch(`/api/track-info/${track}`, { cache: "no-store" })
      .then(r => r.json())
      .then((d: any) => {
        if (d.ok) setTrackNome(d.trackNome ?? "");
        else setNotFound(true);
      })
      .catch(() => setNotFound(true));
  }, [track]);

  function drawBars() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const analyser = analyserRef.current;
    const c = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const data = new Uint8Array(analyser ? analyser.frequencyBinCount : 64);
    if (analyser) analyser.getByteFrequencyData(data);
    c.clearRect(0, 0, W, H);
    const bars = 52, gap = 3;
    const bw = (W - gap*(bars-1)) / bars;
    for (let i = 0; i < bars; i++) {
      const v = analyser ? data[Math.floor(i*data.length/bars)]/255 : 0.05;
      const h = Math.max(4, v*H*0.9);
      const x = i*(bw+gap), y = (H-h)/2;
      const grad = c.createLinearGradient(0, y, 0, y+h);
      grad.addColorStop(0, "rgba(0,198,224,0.5)");
      grad.addColorStop(0.5, "rgba(0,198,224,1)");
      grad.addColorStop(1, "rgba(0,198,224,0.5)");
      c.beginPath(); roundRectPath(c, x, y, bw, h, 2);
      c.fillStyle = grad; c.fill();
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
    src.connect(analyser); analyser.connect(ctx.destination);
    audioCtxRef.current = ctx; analyserRef.current = analyser;
    drawBars();
  }

  async function togglePlay() {
    const audio = audioRef.current!;
    if (!analyserRef.current) await setupAnalyser();
    if (audioCtxRef.current?.state === "suspended") await audioCtxRef.current.resume();
    if (playing) {
      audio.pause(); cancelAnimationFrame(animRef.current); setPlaying(false);
    } else {
      await audio.play(); drawBars(); setPlaying(true);
    }
  }

  useEffect(() => () => {
    cancelAnimationFrame(animRef.current);
    audioCtxRef.current?.close();
  }, []);

  const progress = duration ? (current/duration)*100 : 0;

  if (notFound) {
    return (
      <div className="dark min-h-dvh bg-background flex flex-col items-center justify-center px-4 gap-6 text-center">
        <Music2 className="h-12 w-12 text-muted-foreground" />
        <div>
          <h1 className="text-xl font-bold">Música não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este chaveiro ainda não foi configurado.</p>
        </div>
        <a href={WHATSAPP} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition">
          <MessageCircle className="h-4 w-4" /> Falar com a JM3D
        </a>
      </div>
    );
  }

  return (
    <div className="dark min-h-dvh bg-background flex flex-col">
      <header className="border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between pt-safe">
        <a href="/" className="min-h-[44px] flex items-center">
          <img src={logo} alt="JM3D" className="h-10 w-auto object-contain" />
        </a>
        <a href={WHATSAPP} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium hover:bg-primary/20 glow-border transition min-h-[44px]">
          <MessageCircle className="h-4 w-4 text-primary" /> Quero o meu
        </a>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">

          {/* Disco */}
          <div className="relative">
            <div className="h-44 w-44 rounded-full glass border border-primary/30 glow-strong flex items-center justify-center"
              style={{ animation: playing ? "jm3d-spin 8s linear infinite" : "none",
                background: "conic-gradient(from 0deg,rgba(0,198,224,0.15),rgba(0,0,0,0),rgba(0,198,224,0.15),rgba(0,0,0,0))" }}>
              <div className="h-12 w-12 rounded-full bg-background border border-primary/20 flex items-center justify-center">
                <Music2 className="h-5 w-5 text-primary" />
              </div>
            </div>
            {playing && (
              <div className="absolute inset-0 rounded-full border border-primary/30"
                style={{ animation: "jm3d-ping 1.8s ease-out infinite" }} />
            )}
          </div>

          <style>{`
            @keyframes jm3d-spin { to { transform: rotate(360deg); } }
            @keyframes jm3d-ping { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.35);opacity:0} }
          `}</style>

          {/* Info */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">Memória Sonora</h1>
            {trackNome && (
              <p className="mt-1 text-base text-primary font-semibold">{trackNome}</p>
            )}
          </div>

          {/* Share */}
          <button onClick={async () => {
            if (navigator.share) {
              await navigator.share({ title: `Memória Sonora de ${trackNome || track}`, url: window.location.href });
            } else {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true); setTimeout(()=>setCopied(false),2000);
            }
          }} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition border border-border/40 glass">
            <Share2 className="h-4 w-4" />
            {copied ? "Link copiado!" : "Compartilhar"}
          </button>

          {/* Visualizador */}
          <div className="w-full glass rounded-2xl p-4 border border-primary/10">
            <canvas ref={canvasRef} width={600} height={60} className="w-full h-[60px]" />
          </div>

          {/* Progresso */}
          <div className="w-full flex flex-col gap-2">
            <div className="w-full py-5 cursor-pointer relative -my-4"
              onClick={e=>{
                const rect=e.currentTarget.getBoundingClientRect();
                const pct=(e.clientX-rect.left)/rect.width;
                if(audioRef.current) audioRef.current.currentTime=pct*duration;
              }}>
              <div className="w-full h-1 rounded-full bg-border relative">
                <div className="h-full rounded-full bg-primary transition-all relative" style={{width:`${progress}%`}}>
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary shadow-[0_0_8px_rgba(0,198,224,0.8)]" />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{fmt(current)}</span>
              <span>{fmt(duration)}</span>
            </div>
          </div>

          {/* Play */}
          <button onClick={togglePlay} disabled={!ready}
            className={`h-16 w-16 rounded-full flex items-center justify-center transition ${ready?"bg-primary text-primary-foreground glow-strong hover:opacity-90":"bg-primary/20 text-muted-foreground cursor-default"}`}>
            {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 ml-0.5" />}
          </button>

          <audio ref={audioRef} src={audioSrc}
            onLoadedMetadata={e=>{
              const a=e.currentTarget;
              setDuration(a.duration); setReady(true);
              try {
                const saved=localStorage.getItem(`jm3d-pos-${track}`);
                if(saved) a.currentTime=parseFloat(saved);
              } catch {}
            }}
            onTimeUpdate={e=>{
              const t=e.currentTarget.currentTime;
              setCurrent(t);
              const now=Date.now();
              if(now-lastSaveRef.current>=5000){
                try { localStorage.setItem(`jm3d-pos-${track}`,String(t)); } catch {}
                lastSaveRef.current=now;
              }
            }}
            onEnded={()=>{
              setPlaying(false);
              try { localStorage.removeItem(`jm3d-pos-${track}`); } catch {}
            }}
            onError={()=>setNotFound(true)}
          />

          {/* CTA */}
          <div className="w-full glass rounded-2xl p-5 border border-primary/10 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Quer um chaveiro com a <span className="text-foreground font-medium">sua música</span>?
            </p>
            <a href={WHATSAPP} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition min-h-[44px]">
              <MessageCircle className="h-4 w-4" /> Solicitar Orçamento
            </a>
          </div>

        </div>
      </main>

      <footer className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground pb-safe">
        © 2026 JM3D — Imagine. Crie. Imprima.
      </footer>
    </div>
  );
}
