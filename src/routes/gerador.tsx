import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback } from "react";
import {
  Upload, Download, RotateCcw, Music2, MessageCircle,
  CheckCircle2, Loader2, Send, User,
} from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/gerador")({
  component: GeradorPage,
});

const WHATSAPP = "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20um%20or%C3%A7amento";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Settings {
  radius: number;
  gap: number;
  minH: number;
  style: "bars" | "mirror";
  waveColor: string;
  bgColor: string;
  format: "svg" | "png-dark" | "png-white" | "png-transparent";
}
type PublishStatus = "idle" | "uploading" | "done" | "error";

const WAVE_COLORS = ["#00c6e0","#ffffff","#e0dbd2","#ff6b6b","#ffd166","#06d6a0","#000000"];
const BG_COLORS   = ["#0a0a0a","#ffffff","#1a1a2e","#2d1b69","transparent"];

const DEFAULT: Settings = {
  radius: 2, gap: 20, minH: 10,
  style: "bars", waveColor: "#00c6e0", bgColor: "#0a0a0a", format: "svg",
};

// ─── ID — 8 chars aleatórios, puramente únicos ────────────────────────────────
function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * 36)]).join("");
}

// ─── Spotify Code Algorithm ───────────────────────────────────────────────────
const NUM_DATA_BARS = 23;
const NUM_BARS      = 25;
const LEVELS        = 8;
const MIN_AMP       = 0.12;
const MAX_AMP       = 1.0;

function toGray(n: number): number { return n ^ (n >> 1); }
function bin1count(n: number): number { let c=0; while(n){c+=n&1;n>>=1;} return c; }
function hashId(s: string): number {
  let h=5381;
  for (const c of s) h=((h<<5)+h+c.charCodeAt(0))&0x1FFFFFFFFF;
  return h>>>0;
}
function convolve(bits: number[], numOutput: number): number[] {
  const G1=0b10011,G2=0b11101; let state=0; const out: number[]=[];
  for (const bit of bits) {
    state=((state<<1)|bit)&0b11111;
    out.push(bin1count(state&G1)%2,bin1count(state&G2)%2);
    if (out.length>=numOutput) break;
  }
  return out.slice(0,numOutput);
}

/** Converte track ID em 25 amplitudes — 8 níveis discretos como Spotify */
function encodeToAmps(trackId: string): number[] {
  const bitsNeeded = NUM_DATA_BARS * 3;
  const h = hashId(trackId);
  const idBits: number[] = [];
  for (let i=0; i<bitsNeeded/2; i++) idBits.push((h>>(i%37))&1);
  const encoded = convolve(idBits, bitsNeeded);
  const symbols: number[] = [];
  for (let i=0; i<encoded.length; i+=3)
    symbols.push((encoded[i]??0)*4+(encoded[i+1]??0)*2+(encoded[i+2]??0));
  const dataAmps = symbols.slice(0,NUM_DATA_BARS).map(s=>
    MIN_AMP+(toGray(s)/(LEVELS-1))*(MAX_AMP-MIN_AMP)
  );
  return [MIN_AMP,...dataAmps,MIN_AMP];
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y); ctx.lineTo(x+w-rr,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
  ctx.lineTo(x+w,y+h-rr);
  ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  ctx.lineTo(x+rr,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
  ctx.lineTo(x,y+rr);
  ctx.quadraticCurveTo(x,y,x+rr,y);
  ctx.closePath(); ctx.fill();
}

function drawWave(canvas: HTMLCanvasElement, amps: number[], s: Settings, W: number, H: number, bg?: string, color?: string) {
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext("2d")!;
  const bgColor=bg??s.bgColor;
  if (bgColor==="transparent"){ctx.clearRect(0,0,W,H);}
  else {ctx.fillStyle=bgColor; ctx.fillRect(0,0,W,H);}
  if (!amps.length) return;
  ctx.fillStyle=color??s.waveColor;
  const n=amps.length;
  const gapFrac=s.gap/100;
  const totalBar=W/n, barW=totalBar*(1-gapFrac), barGap=totalBar*gapFrac;
  amps.forEach((amp,i)=>{
    const x=i*totalBar+barGap/2;
    const barH=Math.max(amp*H*0.88, H*(s.minH/100));
    if (s.style==="bars") roundRect(ctx,x,(H-barH)/2,barW,barH,s.radius);
    else { const half=barH/2; roundRect(ctx,x,H/2-half-1,barW,half,s.radius); roundRect(ctx,x,H/2+1,barW,half,s.radius); }
  });
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({label,value,min,max,unit="",onChange}:{label:string;value:number;min:number;max:number;unit?:string;onChange:(v:number)=>void}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-primary font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        className="w-full accent-primary h-2 bg-border rounded cursor-pointer"
        style={{touchAction:"none"}}/>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function GeradorPage() {
  const [s, setS]               = useState<Settings>(DEFAULT);
  const [amps, setAmps]         = useState<number[]>([]);
  const [trackId, setTrackId]   = useState("");
  const [trackNome, setTrackNome] = useState("");
  const [fileName, setFileName] = useState("");
  const [duration, setDuration] = useState("");
  const [audioFile, setAudioFile] = useState<File|null>(null);
  const [status, setStatus]     = useState<{msg:string;ok?:boolean}|null>(null);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishMsg, setPublishMsg]       = useState("");
  const [publishProgress, setPublishProgress] = useState(0);
  const [playerUrl, setPlayerUrl] = useState("");

  const previewRef  = useRef<HTMLCanvasElement>(null);
  const chaveiroRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const set = (p: Partial<Settings>) => setS(prev=>({...prev,...p}));

  const redraw = useCallback((waveAmps: number[], settings: Settings) => {
    if (previewRef.current) {
      const W=previewRef.current.offsetWidth*devicePixelRatio||800;
      drawWave(previewRef.current,waveAmps,settings,W,200);
    }
    if (chaveiroRef.current) {
      // Preview do chaveiro com nota musical como âncora
      const CW=580, CH=160;
      chaveiroRef.current.width=CW; chaveiroRef.current.height=CH;
      const ctx=chaveiroRef.current.getContext("2d")!;
      ctx.save();
      const pad=10, rx=14;
      const buildPath=()=>{
        ctx.beginPath();
        ctx.moveTo(pad+rx,pad); ctx.lineTo(CW-pad-rx,pad);
        ctx.quadraticCurveTo(CW-pad,pad,CW-pad,pad+rx);
        ctx.lineTo(CW-pad,CH-pad-rx);
        ctx.quadraticCurveTo(CW-pad,CH-pad,CW-pad-rx,CH-pad);
        ctx.lineTo(pad+rx,CH-pad);
        ctx.quadraticCurveTo(pad,CH-pad,pad,CH-pad-rx);
        ctx.lineTo(pad,pad+rx);
        ctx.quadraticCurveTo(pad,pad,pad+rx,pad);
        ctx.closePath();
      };
      const bg=settings.bgColor==="transparent"?"#1a1a1a":settings.bgColor;
      ctx.fillStyle=bg; buildPath(); ctx.fill(); buildPath(); ctx.clip();

      // Buraco do chaveiro
      ctx.beginPath(); ctx.arc(pad+22,CH/2,9,0,Math.PI*2);
      ctx.fillStyle="#060606"; ctx.fill();
      ctx.strokeStyle="#444"; ctx.lineWidth=1; ctx.stroke();

      // Waveform no chaveiro (sem nota — igual ao Spotify)
      if (waveAmps.length) {
        const leftX=pad+38, rightX=CW-pad-8;
        const tmp=document.createElement("canvas");
        drawWave(tmp,waveAmps,settings,rightX-leftX,CH-pad*2-8,"transparent");
        ctx.drawImage(tmp,leftX,pad+4);
      }
      ctx.restore();
    }
  }, []);

  const generateAndDraw = useCallback((nome: string) => {
    if (!nome.trim()) return;
    const id = generateId();
    setTrackId(id);
    const codeAmps = encodeToAmps(id);
    setAmps(codeAmps);
    redraw(codeAmps, s);
    setStatus({msg:`ID gerado: ${id}`, ok:true});
    return {id, codeAmps};
  }, [s, redraw]);

  const update = (p: Partial<Settings>) => {
    const next={...s,...p}; set(p);
    if (amps.length) redraw(amps,next);
  };

  const handleFile = async (file: File) => {
    setStatus({msg:"Carregando áudio…"});
    setFileName(file.name);
    setAudioFile(file);
    setPublishStatus("idle");
    setPlayerUrl("");
    try {
      const buf=await file.arrayBuffer();
      const audioCtx=new AudioContext();
      const buffer=await audioCtx.decodeAudioData(buf);
      await audioCtx.close();
      const mins=Math.floor(buffer.duration/60);
      const secs=Math.floor(buffer.duration%60).toString().padStart(2,"0");
      setDuration(`${mins}:${secs}`);
      setStatus({msg:"Áudio carregado ✓", ok:true});
    } catch { setStatus({msg:"Erro ao decodificar o áudio.",ok:false}); }
  };

  const handleNomeBlur = (nome: string) => {
    if (!nome.trim() || trackId) return; // só gera se não tiver ID ainda
    generateAndDraw(nome);
  };

  // Exporta SVG com nota musical ♪ como âncora
  const exportSVG = () => {
    if (!amps.length) return;
    const NOTE_W = 0;
    const W=500, H=100;
    const n=amps.length;
    const gapFrac=s.gap/100;
    const waveW=W-NOTE_W;
    const totalBar=waveW/n, barW=totalBar*(1-gapFrac), barGap=totalBar*gapFrac;
    const bg=s.bgColor==="transparent"?"none":s.bgColor;

    // Sem nota — barras começam do início (igual ao Spotify Code)
    const noteEl="";

    let rects="";
    amps.forEach((amp,i)=>{
      const x=i*totalBar+barGap/2;
      const barH=Math.max(amp*H*0.88,H*(s.minH/100));
      const r=Math.min(s.radius,barW/2,barH/2);
      const getRect=(y:number,h:number)=>
        `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${s.waveColor}"/>`;
      if (s.style==="bars") rects+=getRect((H-barH)/2,barH);
      else { const half=barH/2; rects+=getRect(H/2-half-1,half); rects+=getRect(H/2+1,half); }
    });

    const svg=`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${noteEl}
  ${rects}
</svg>`;
    downloadBlob("jm3d-waveform.svg",new Blob([svg],{type:"image/svg+xml"}));
    setStatus({msg:"SVG exportado ✓",ok:true});
  };

  const exportPNG = () => {
    if (!amps.length) return;
    const isWhite=s.format==="png-white", isTrans=s.format==="png-transparent";
    const bgColor=isTrans?"transparent":isWhite?"#ffffff":s.bgColor;
    const waveColor=isWhite?"#000000":s.waveColor;

    // Canvas com nota ♪ + waveform (igual ao SVG e ao preview do chaveiro)
    const NOTE_W=0, W=1000, H=200;
    const c=document.createElement("canvas");
    c.width=W; c.height=H;
    const ctx=c.getContext("2d")!;

    // Fundo
    if (bgColor==="transparent") ctx.clearRect(0,0,W,H);
    else { ctx.fillStyle=bgColor; ctx.fillRect(0,0,W,H); }

    // Sem nota — waveform pura (igual ao Spotify Code)
    const tmp=document.createElement("canvas");
    drawWave(tmp,amps,{...s,waveColor,bgColor:"transparent"},W,H);
    ctx.drawImage(tmp,0,0);

    c.toBlob(blob=>{if(blob){downloadBlob("jm3d-waveform.png",blob);setStatus({msg:"PNG exportado ✓",ok:true});}}, "image/png");
  };

  // Publica: sobe áudio + salva amplitudes em JSON no R2
  const handlePublish = async () => {
    if (!audioFile||!trackId||!trackNome) {
      setStatus({msg:"Preencha o nome e selecione o áudio antes de publicar.",ok:false});
      return;
    }
    setPublishStatus("uploading");
    setPublishMsg("Enviando áudio…");
    setPublishProgress(20);
    try {
      // 1. Sobe áudio
      const form=new FormData();
      form.append("trackId",trackId);
      form.append("trackNome",trackNome);
      form.append("audio",audioFile);
      // Inclui as amplitudes no upload para salvar no R2
      // Amplitudes VISUAIS — com minH aplicado, igual ao que o scanner vai medir
      // Sem isso, o R2 salva amplitudes teóricas mas o scanner mede as visuais
      const H_ref = 200; // altura de referência do canvas
      const visualAmps = amps.map(a =>
        Math.max(a * H_ref * 0.88, H_ref * (s.minH / 100)) / (H_ref * 0.88)
      );
      // Renormaliza para 0.12-1.0
      const vMin = Math.min(...visualAmps), vMax = Math.max(...visualAmps);
      const vRange = vMax - vMin || 1;
      const normalizedVisual = visualAmps.map(a => 0.12 + ((a - vMin) / vRange) * 0.88);
      form.append("amps", JSON.stringify(normalizedVisual));

      const res=await fetch("/api/upload",{method:"POST",body:form});
      const json=await res.json() as any;
      if (!res.ok) throw new Error(json.error||"Erro no upload.");

      setPublishProgress(100);
      setPublishStatus("done");
      setPlayerUrl(json.playerUrl);
      setStatus({msg:`✓ ${trackNome} publicado! ID: ${trackId}`,ok:true});
    } catch(err:any) {
      setPublishStatus("error");
      setPublishMsg(err?.message||"Erro ao publicar.");
    }
  };

  function downloadBlob(name:string,blob:Blob){
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
  }

  const reset=()=>{
    setS(DEFAULT); setAmps([]); setTrackId(""); setTrackNome("");
    setFileName(""); setDuration(""); setAudioFile(null); setStatus(null);
    setPublishStatus("idle"); setPublishMsg(""); setPlayerUrl("");
    if (fileInputRef.current) fileInputRef.current.value="";
    if (previewRef.current) {
      const ctx=previewRef.current.getContext("2d")!;
      ctx.clearRect(0,0,previewRef.current.width,previewRef.current.height);
    }
  };

  const isPublishing=publishStatus==="uploading";

  return (
    <div className="dark min-h-dvh bg-background">
      <header className="border-b border-border/50 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between pt-safe">
        <a href="/" className="min-h-[44px] flex items-center">
          <img src={logo} alt="JM3D" className="h-10 w-auto"/>
        </a>
        <a href={WHATSAPP} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm font-medium hover:bg-primary/20 transition min-h-[44px]">
          <MessageCircle className="h-4 w-4 text-primary"/>
          <span className="hidden sm:inline">Solicitar Orçamento</span>
          <span className="sm:hidden">Orçamento</span>
        </a>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-6 sm:gap-8 pb-safe">

        <div>
          <h1 className="text-3xl sm:text-4xl font-bold">Gerador de <span className="text-gradient">Waveform</span></h1>
          <p className="mt-2 text-muted-foreground text-sm">Algoritmo Spotify Code — 8 níveis de altura, leitura precisa.</p>
        </div>

        {/* CLIENTE */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-primary/10">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4 text-primary"/> Dados do Cliente
          </h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-widest">Nome completo</label>
            <input value={trackNome}
              onChange={e=>setTrackNome(e.target.value)}
              onBlur={e=>handleNomeBlur(e.target.value)}
              placeholder="Ex: Patricia Soares"
              className="rounded-xl border border-border bg-card text-sm px-3 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary min-h-[44px]"/>
          </div>
          {trackId && (
            <div className="flex flex-col gap-1 px-1">
              <p className="text-xs text-muted-foreground">ID: <span className="text-primary font-mono text-sm">{trackId}</span></p>
              <p className="text-xs text-muted-foreground">Player: <span className="text-primary font-mono">/musica?track={trackId}</span></p>
            </div>
          )}
        </div>

        {/* UPLOAD */}
        <div onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
          onDragOver={e=>e.preventDefault()} onClick={()=>fileInputRef.current?.click()}
          className="glass rounded-2xl border-2 border-dashed border-border hover:border-primary/60 transition cursor-pointer p-6 sm:p-10 text-center group min-h-[120px] flex flex-col items-center justify-center">
          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
            onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition">
            {fileName?<Music2 className="h-7 w-7"/>:<Upload className="h-7 w-7"/>}
          </div>
          {fileName?(
            <><p className="font-medium text-sm text-foreground">{fileName}</p>
              <p className="text-xs text-muted-foreground mt-1">{duration} · clique para trocar</p></>
          ):(
            <><p className="text-sm text-muted-foreground">Arraste o áudio ou <span className="text-primary">clique para selecionar</span></p>
              <p className="text-xs text-muted-foreground mt-1">MP3 · WAV · OGG · M4A · FLAC</p></>
          )}
        </div>

        {status&&(
          <p className={`text-xs font-mono ${status.ok===true?"text-primary":status.ok===false?"text-red-400":"text-muted-foreground"}`}>
            {status.msg}
          </p>
        )}

        {/* CONFIGURAÇÕES */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Configurações visuais</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Slider label="Arredondamento" value={s.radius} min={0} max={8} onChange={v=>update({radius:v})}/>
            <Slider label="Espaçamento" value={s.gap} min={10} max={60} unit="%" onChange={v=>update({gap:v})}/>
            <Slider label="Altura mínima" value={s.minH} min={5} max={25} unit="%" onChange={v=>update({minH:v})}/>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Estilo</span>
              <select value={s.style} onChange={e=>update({style:e.target.value as Settings["style"]})}
                className="rounded-xl border border-border bg-card text-sm px-3 py-2 text-foreground focus:outline-none focus:border-primary min-h-[44px]">
                <option value="bars">Barras simétricas</option>
                <option value="mirror">Espelho</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Exportar como</span>
              <select value={s.format} onChange={e=>set({format:e.target.value as Settings["format"]})}
                className="rounded-xl border border-border bg-card text-sm px-3 py-2 text-foreground focus:outline-none focus:border-primary min-h-[44px]">
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
                {WAVE_COLORS.map(c=>(
                  <button key={c} onClick={()=>update({waveColor:c})} style={{background:c}}
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-lg border transition hover:scale-110 ${s.waveColor===c?"border-primary ring-2 ring-primary ring-offset-2 ring-offset-background":"border-border"}`}/>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-widest">Fundo</span>
              <div className="flex gap-2 flex-wrap">
                {BG_COLORS.map(c=>(
                  <button key={c} onClick={()=>update({bgColor:c})}
                    style={c==="transparent"?{backgroundImage:"repeating-conic-gradient(#555 0% 25%,#222 0% 50%)",backgroundSize:"10px 10px"}:{background:c}}
                    className={`h-10 w-10 sm:h-8 sm:w-8 rounded-lg border transition hover:scale-110 ${s.bgColor===c?"border-primary ring-2 ring-primary ring-offset-2 ring-offset-background":"border-border"}`}/>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* PREVIEW WAVEFORM */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Preview — Waveform</h2>
          <div className="rounded-xl overflow-hidden border border-border">
            <canvas ref={previewRef} style={{width:"100%",height:"100px",display:"block"}}/>
          </div>
        </div>

        {/* PREVIEW CHAVEIRO com nota musical */}
        <div className="glass rounded-2xl p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Preview — Chaveiro
          </h2>
          <div className="flex justify-center rounded-xl bg-[#141414] border border-border p-6">
            <canvas ref={chaveiroRef} style={{maxWidth:"100%",borderRadius:"8px"}}/>
          </div>
        </div>

        {/* PUBLICAR */}
        {amps.length>0&&(
          <div className="glass rounded-2xl p-6 flex flex-col gap-4 border border-primary/20">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <Send className="h-4 w-4 text-primary"/> Publicar Memória Sonora
              </h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Sobe o áudio e salva as amplitudes no R2 — scanner compara direto, sem recalcular.
              </p>
            </div>

            {isPublishing&&(
              <div className="flex flex-col gap-2">
                <div className="w-full h-1 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{width:`${publishProgress}%`}}/>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{publishMsg}</p>
              </div>
            )}

            {publishStatus==="done"&&(
              <div className="flex flex-col gap-2 rounded-xl bg-primary/5 border border-primary/20 px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0"/>
                  <span className="text-xs text-foreground font-medium">Publicado! Exporte o SVG e imprima o chaveiro.</span>
                </div>
                {playerUrl&&(
                  <a href={playerUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline font-mono">
                    🎵 jm3d.com.br{playerUrl}
                  </a>
                )}
              </div>
            )}

            {publishStatus==="error"&&(
              <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3 text-xs text-red-400">
                {publishMsg}
              </div>
            )}

            <button onClick={handlePublish}
              disabled={isPublishing||!audioFile||!trackId||!trackNome}
              className="self-start inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px]">
              {isPublishing?<><Loader2 className="h-4 w-4 animate-spin"/>Enviando…</>:
               publishStatus==="done"?<><CheckCircle2 className="h-4 w-4"/>Publicar novamente</>:
               <><Send className="h-4 w-4"/>Publicar memória sonora</>}
            </button>
          </div>
        )}

        {/* EXPORTAR */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={exportSVG} disabled={!amps.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary/10 border border-primary/40 px-6 py-3 text-sm font-medium hover:bg-primary/20 transition disabled:opacity-30 disabled:cursor-not-allowed glow-border min-h-[44px]">
            <Download className="h-4 w-4 text-primary"/> Exportar SVG
          </button>
          <button onClick={exportPNG} disabled={!amps.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]">
            <Download className="h-4 w-4"/> Exportar PNG
          </button>
          <button onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium hover:border-primary/40 transition min-h-[44px]">
            <RotateCcw className="h-4 w-4"/> Reiniciar
          </button>
        </div>

      </main>
    </div>
  );
}
