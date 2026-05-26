import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useCallback } from "react";
import {
  Upload, Download, RotateCcw, Music2, MessageCircle,
  CheckCircle2, Loader2, Send, User, RotateCcw as Reload,
} from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/gerador")({ component: GeradorPage });

const WHATSAPP = "https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20um%20or%C3%A7amento";

interface Settings {
  radius: number; gap: number; minH: number;
  style: "bars"|"mirror"; waveColor: string; bgColor: string;
  format: "svg"|"png-dark"|"png-white"|"png-transparent";
}
type PublishStatus = "idle"|"uploading"|"done"|"error";

const WAVE_COLORS = ["#00c6e0","#ffffff","#e0dbd2","#ff6b6b","#ffd166","#06d6a0","#000000"];
const BG_COLORS   = ["#0a0a0a","#ffffff","#1a1a2e","#2d1b69","transparent"];
const DEFAULT: Settings = { radius:2, gap:60, minH:10, style:"bars", waveColor:"#00c6e0", bgColor:"#0a0a0a", format:"svg" };

// ─── Encoding — Spotify Code Algorithm ───────────────────────────────────────
const NUM_DATA_BARS = 16;
const NUM_BARS      = 18;  // 1 START + 16 dados + 1 END
const LEVELS        = 4;   // 4 níveis: diferença física 0.30mm com relevo 1.2mm
const MIN_AMP       = 0.25;
const MAX_AMP       = 1.0;
const LEVEL_VALUES  = [0.25, 0.50, 0.75, 1.0];

function toGray(n:number):number{return n^(n>>1);}
function bin1count(n:number):number{let c=0;while(n){c+=n&1;n>>=1;}return c;}
function hashId(s:string):number{
  let h=5381;
  for(const c of s) h=((h<<5)+h+c.charCodeAt(0))&0x1FFFFFFFFF;
  return h>>>0;
}
function convolve(bits:number[],numOutput:number):number[]{
  const G1=0b10011,G2=0b11101;let state=0;const out:number[]=[];
  for(const bit of bits){
    state=((state<<1)|bit)&0b11111;
    out.push(bin1count(state&G1)%2,bin1count(state&G2)%2);
    if(out.length>=numOutput) break;
  }
  return out.slice(0,numOutput);
}

function encodeToAmps(trackId:string):number[]{
  const BITS=2, bitsNeeded=NUM_DATA_BARS*BITS;
  const h=hashId(trackId);
  const idBits:number[]=[];
  for(let i=0;i<bitsNeeded;i++) idBits.push((h>>(i%37))&1);
  const encoded=convolve(idBits,bitsNeeded);
  const symbols:number[]=[];
  for(let i=0;i<encoded.length;i+=BITS)
    symbols.push(((encoded[i]??0)<<1)|(encoded[i+1]??0));
  const dataAmps=symbols.slice(0,NUM_DATA_BARS).map(s=>
    MIN_AMP+(toGray(s)%LEVELS)/(LEVELS-1)*(MAX_AMP-MIN_AMP)
  );
  return [MAX_AMP,...dataAmps,MIN_AMP];
}

function generateId():string{
  const chars="abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({length:8},()=>chars[Math.floor(Math.random()*36)]).join("");
}

function quantizeLevel(amp:number):number{
  return LEVEL_VALUES.reduce((b,lv)=>Math.abs(lv-amp)<Math.abs(b-amp)?lv:b);
}

function checkCollision(newAmps:number[],existingAmps:number[][]): boolean{
  const newIdx=newAmps.map(a=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
  for(const e of existingAmps){
    const eIdx=e.every((v:number)=>v>=0&&v<=3&&Number.isInteger(v))
      ? e
      : e.map((a:number)=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
    let matches=0;
    for(let i=0;i<Math.min(newIdx.length,eIdx.length);i++)
      if(newIdx[i]===eIdx[i]) matches++;
    if(matches/newAmps.length>0.60) return true;
  }
  return false;
}

async function generateSafeId(currentId:string):Promise<{id:string;amps:number[]}|null>{
  let existingAmps:number[][]=[];
  try{
    const res=await fetch("/api/amps");
    const data=await res.json() as any;
    existingAmps=(data.tracks??[]).filter((t:any)=>t.trackId!==currentId).map((t:any)=>t.amps);
  }catch{}
  for(let attempt=0;attempt<50;attempt++){
    const id=generateId();
    const newAmps=encodeToAmps(id);
    if(!checkCollision(newAmps,existingAmps)) return {id,amps:newAmps};
  }
  return null;
}

// ─── Canvas helpers ───────────────────────────────────────────────────────────
function roundRect(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){
  const rr=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr,y);ctx.lineTo(x+w-rr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+rr);
  ctx.lineTo(x+w,y+h-rr);ctx.quadraticCurveTo(x+w,y+h,x+w-rr,y+h);
  ctx.lineTo(x+rr,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-rr);
  ctx.lineTo(x,y+rr);ctx.quadraticCurveTo(x,y,x+rr,y);
  ctx.closePath();ctx.fill();
}

function drawWave(canvas:HTMLCanvasElement,amps:number[],s:Settings,W:number,H:number,bg?:string,color?:string){
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d")!;
  const bgColor=bg??s.bgColor;
  if(bgColor==="transparent")ctx.clearRect(0,0,W,H);
  else{ctx.fillStyle=bgColor;ctx.fillRect(0,0,W,H);}
  if(!amps.length) return;
  ctx.fillStyle=color??s.waveColor;
  const n=amps.length,gapFrac=s.gap/100;
  const totalBar=W/n,barW=totalBar*(1-gapFrac),barGap=totalBar*gapFrac;
  amps.forEach((amp,i)=>{
    const x=i*totalBar+barGap/2;
    const barH=Math.max(amp*H*0.88,H*(s.minH/100));
    if(s.style==="bars") roundRect(ctx,x,(H-barH)/2,barW,barH,s.radius);
    else{const half=barH/2;roundRect(ctx,x,H/2-half-1,barW,half,s.radius);roundRect(ctx,x,H/2+1,barW,half,s.radius);}
  });
}

function downloadBlob(name:string,blob:Blob){
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;a.click();
  URL.revokeObjectURL(url);
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({label,value,min,max,unit="",onChange}:{label:string;value:number;min:number;max:number;unit?:string;onChange:(v:number)=>void}){
  return(
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-white/50 uppercase tracking-widest">{label}</span>
        <span className="text-cyan-400 font-mono">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        className="w-full accent-cyan-400 h-1.5 rounded cursor-pointer"
        style={{touchAction:"none"}}/>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
function GeradorPage(){
  const [s,setS]=useState<Settings>(DEFAULT);
  const [amps,setAmps]=useState<number[]>([]);
  const [trackId,setTrackId]=useState("");
  const [trackNome,setTrackNome]=useState("");
  const [fileName,setFileName]=useState("");
  const [duration,setDuration]=useState("");
  const [audioFile,setAudioFile]=useState<File|null>(null);
  const [status,setStatus]=useState<{msg:string;ok?:boolean}|null>(null);
  const [publishStatus,setPublishStatus]=useState<PublishStatus>("idle");
  const [publishMsg,setPublishMsg]=useState("");
  const [publishProgress,setPublishProgress]=useState(0);
  const [playerUrl,setPlayerUrl]=useState("");
  const [isRegenerating,setIsRegenerating]=useState(false);

  const previewRef=useRef<HTMLCanvasElement>(null);
  const chaveiroRef=useRef<HTMLCanvasElement>(null);
  const fileInputRef=useRef<HTMLInputElement>(null);

  const set=(p:Partial<Settings>)=>setS(prev=>({...prev,...p}));

  const redraw=useCallback((waveAmps:number[],settings:Settings)=>{
    if(previewRef.current){
      const W=previewRef.current.offsetWidth*devicePixelRatio||800;
      drawWave(previewRef.current,waveAmps,settings,W,180);
    }
    if(chaveiroRef.current){
      const CW=560,CH=150;
      chaveiroRef.current.width=CW;chaveiroRef.current.height=CH;
      const ctx=chaveiroRef.current.getContext("2d")!;
      ctx.save();
      const pad=10,rx=14;
      const buildPath=()=>{
        ctx.beginPath();
        ctx.moveTo(pad+rx,pad);ctx.lineTo(CW-pad-rx,pad);ctx.quadraticCurveTo(CW-pad,pad,CW-pad,pad+rx);
        ctx.lineTo(CW-pad,CH-pad-rx);ctx.quadraticCurveTo(CW-pad,CH-pad,CW-pad-rx,CH-pad);
        ctx.lineTo(pad+rx,CH-pad);ctx.quadraticCurveTo(pad,CH-pad,pad,CH-pad-rx);
        ctx.lineTo(pad,pad+rx);ctx.quadraticCurveTo(pad,pad,pad+rx,pad);ctx.closePath();
      };
      const bg=settings.bgColor==="transparent"?"#1a1a1a":settings.bgColor;
      ctx.fillStyle=bg;buildPath();ctx.fill();buildPath();ctx.clip();
      ctx.beginPath();ctx.arc(pad+22,CH/2,9,0,Math.PI*2);
      ctx.fillStyle="#060606";ctx.fill();ctx.strokeStyle="#333";ctx.lineWidth=1;ctx.stroke();
      if(waveAmps.length){
        const leftX=pad+38,rightX=CW-pad-8;
        const tmp=document.createElement("canvas");
        drawWave(tmp,waveAmps,settings,rightX-leftX,CH-pad*2-8,"transparent");
        ctx.drawImage(tmp,leftX,pad+4);
      }
      ctx.restore();
    }
  },[]);

  const generateAndDraw=useCallback((nome:string)=>{
    if(!nome.trim()) return;
    const id=generateId();
    setTrackId(id);
    const codeAmps=encodeToAmps(id);
    setAmps(codeAmps);
    redraw(codeAmps,s);
    setStatus({msg:`ID gerado: ${id}`,ok:true});
    return {id,codeAmps};
  },[s,redraw]);

  const update=(p:Partial<Settings>)=>{
    const next={...s,...p};set(p);
    if(amps.length) redraw(amps,next);
  };

  const handleFile=async(file:File)=>{
    setStatus({msg:"Carregando áudio…"});
    setFileName(file.name);setAudioFile(file);setPublishStatus("idle");setPlayerUrl("");
    try{
      const buf=await file.arrayBuffer();
      const audioCtx=new AudioContext();
      const buffer=await audioCtx.decodeAudioData(buf);
      await audioCtx.close();
      const mins=Math.floor(buffer.duration/60);
      const secs=Math.floor(buffer.duration%60).toString().padStart(2,"0");
      setDuration(`${mins}:${secs}`);
      setStatus({msg:"Áudio carregado ✓",ok:true});
    }catch{setStatus({msg:"Erro ao decodificar o áudio.",ok:false});}
  };

  const handleNomeBlur=(nome:string)=>{
    if(!nome.trim()||trackId) return;
    generateAndDraw(nome);
  };

  const exportSVG=()=>{
    if(!amps.length) return;
    const W=500,H=100,n=amps.length,gapFrac=s.gap/100;
    const totalBar=W/n,barW=totalBar*(1-gapFrac),barGap=totalBar*gapFrac;
    const bg=s.bgColor==="transparent"?"none":s.bgColor;
    let rects="";
    amps.forEach((amp,i)=>{
      const x=i*totalBar+barGap/2,barH=Math.max(amp*H*0.88,H*(s.minH/100));
      const r=Math.min(s.radius,barW/2,barH/2);
      const getRect=(y:number,h:number)=>`<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${r}" fill="${s.waveColor}"/>`;
      if(s.style==="bars") rects+=getRect((H-barH)/2,barH);
      else{const half=barH/2;rects+=getRect(H/2-half-1,half);rects+=getRect(H/2+1,half);}
    });
    const svg=`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${bg}"/>${rects}</svg>`;
    downloadBlob("jm3d-waveform.svg",new Blob([svg],{type:"image/svg+xml"}));
    setStatus({msg:"SVG exportado ✓",ok:true});
  };

  const exportPNG=()=>{
    if(!amps.length) return;
    const isWhite=s.format==="png-white",isTrans=s.format==="png-transparent";
    const bgColor=isTrans?"transparent":isWhite?"#ffffff":s.bgColor;
    const waveColor=isWhite?"#000000":s.waveColor;
    const W=1000,H=200,c=document.createElement("canvas");
    c.width=W;c.height=H;const ctx=c.getContext("2d")!;
    if(bgColor==="transparent")ctx.clearRect(0,0,W,H);
    else{ctx.fillStyle=bgColor;ctx.fillRect(0,0,W,H);}
    const tmp=document.createElement("canvas");
    drawWave(tmp,amps,{...s,waveColor,bgColor:"transparent"},W,H);
    ctx.drawImage(tmp,0,0);
    c.toBlob(blob=>{if(blob){downloadBlob("jm3d-waveform.png",blob);setStatus({msg:"PNG exportado ✓",ok:true});}},"image/png");
  };

  const handleRegenerateId=async()=>{
    setIsRegenerating(true);setStatus({msg:"Gerando novo ID único...",ok:undefined});
    const result=await generateSafeId(trackId);
    if(result){
      setTrackId(result.id);setAmps(result.amps);redraw(result.amps,s);
      setPublishStatus("idle");setPublishMsg("");
      setStatus({msg:`Novo ID: ${result.id} ✓`,ok:true});
    }else{
      setStatus({msg:"Não foi possível gerar ID único. Tente novamente.",ok:false});
    }
    setIsRegenerating(false);
  };

  const handlePublish=async()=>{
    if(!audioFile||!trackId||!trackNome){
      setStatus({msg:"Preencha o nome e selecione o áudio.",ok:false});return;
    }
    setPublishStatus("uploading");setPublishMsg("Verificando unicidade…");setPublishProgress(10);
    try{
      const ampsRes=await fetch("/api/amps");
      const ampsData=await ampsRes.json() as any;
      const existingAmps:number[][]=(ampsData.tracks??[]).filter((t:any)=>t.trackId!==trackId).map((t:any)=>t.amps);
      if(checkCollision(amps,existingAmps)){
        setStatus({msg:"⚠ Padrão similar a outro track existente.",ok:false});
        setPublishStatus("error");setPublishMsg("Colisão detectada — clique em Novo ID");return;
      }
    }catch{}
    setPublishMsg("Enviando áudio…");setPublishProgress(20);
    try{
      const form=new FormData();
      form.append("trackId",trackId);form.append("trackNome",trackNome);form.append("audio",audioFile);
      // Salva índices discretos — compatível com Viterbi decoder
      const ampIndices=amps.map(a=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
      form.append("amps",JSON.stringify(ampIndices));
      const res=await fetch("/api/upload",{method:"POST",body:form});
      const json=await res.json() as any;
      if(!res.ok) throw new Error(json.error||"Erro no upload.");
      setPublishProgress(100);setPublishStatus("done");setPlayerUrl(json.playerUrl);
      setStatus({msg:`✓ ${trackNome} publicado! ID: ${trackId}`,ok:true});
    }catch(err:any){
      setPublishStatus("error");setPublishMsg(err?.message||"Erro ao publicar.");
    }
  };

  const reset=()=>{
    setS(DEFAULT);setAmps([]);setTrackId("");setTrackNome("");
    setFileName("");setDuration("");setAudioFile(null);setStatus(null);
    setPublishStatus("idle");setPublishMsg("");setPlayerUrl("");
    if(fileInputRef.current) fileInputRef.current.value="";
  };

  const isPublishing=publishStatus==="uploading";

  return(
    <div className="dark min-h-dvh bg-[#06060c] text-white">
      <style>{`.accent-cyan-400{accent-color:#00c6e0}`}</style>

      {/* Header */}
      <header className="border-b border-white/5 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 border border-cyan-400/20">
            <img src={logo} alt="JM3D" className="h-5 w-auto"/>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Gerador de Memórias Sonoras</h1>
            <p className="text-[10px] text-white/30">Encoding Spotify Code · 4 níveis · 18 barras</p>
          </div>
        </div>
        <a href={WHATSAPP} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium hover:bg-white/10 transition min-h-[36px]">
          <MessageCircle className="h-3.5 w-3.5 text-green-400"/>Suporte
        </a>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* ── Painel esquerdo ─────────────────────────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-5">

          {/* Cliente */}
          <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2 mb-4">
              <User className="h-3.5 w-3.5 text-cyan-400"/>Dados do Cliente
            </h2>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] text-white/40 uppercase tracking-widest mb-1.5 block">Nome completo</label>
                <input value={trackNome} onChange={e=>setTrackNome(e.target.value)}
                  onBlur={e=>handleNomeBlur(e.target.value)}
                  placeholder="Ex: Patricia Soares"
                  className="w-full h-10 bg-black/40 border border-white/10 rounded-xl px-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-400/40 transition"/>
              </div>
              {trackId&&(
                <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/5">
                  <p className="text-[10px] text-white/30">ID: <span className="text-cyan-400 font-mono">{trackId}</span></p>
                  <p className="text-[10px] text-white/30 mt-0.5">Player: <span className="text-cyan-400/70 font-mono">/musica?track={trackId}</span></p>
                </div>
              )}
            </div>
          </div>

          {/* Upload áudio */}
          <div
            onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            onDragOver={e=>e.preventDefault()}
            onClick={()=>fileInputRef.current?.click()}
            className="bg-[#0c0c14] border border-dashed border-white/10 hover:border-cyan-400/30 rounded-2xl p-5 cursor-pointer transition group">
            <input ref={fileInputRef} type="file" accept="audio/*" className="hidden"
              onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="h-10 w-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center group-hover:scale-110 transition">
                {fileName?<Music2 className="h-5 w-5 text-cyan-400"/>:<Upload className="h-5 w-5 text-cyan-400/60"/>}
              </div>
              {fileName?(
                <>
                  <p className="text-sm font-medium text-white">{fileName}</p>
                  <p className="text-xs text-white/30">{duration} · clique para trocar</p>
                </>
              ):(
                <>
                  <p className="text-sm text-white/40">Arraste ou <span className="text-cyan-400">clique para selecionar</span></p>
                  <p className="text-[10px] text-white/20">MP3 · WAV · OGG · M4A · FLAC</p>
                </>
              )}
            </div>
          </div>

          {status&&(
            <p className={`text-[11px] font-mono px-1 ${status.ok===true?"text-cyan-400":status.ok===false?"text-red-400":"text-white/40"}`}>
              {status.msg}
            </p>
          )}

          {/* Configurações visuais */}
          <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40">Visual</h2>
            <Slider label="Arredondamento" value={s.radius} min={0} max={8} onChange={v=>update({radius:v})}/>
            <Slider label="Espaçamento" value={s.gap} min={10} max={70} unit="%" onChange={v=>update({gap:v})}/>
            <Slider label="Altura mínima" value={s.minH} min={5} max={25} unit="%" onChange={v=>update({minH:v})}/>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Estilo</span>
              <div className="grid grid-cols-2 gap-2">
                {(["bars","mirror"] as const).map(st=>(
                  <button key={st} onClick={()=>update({style:st})}
                    className={`h-9 text-xs rounded-xl border font-medium transition ${s.style===st?"bg-cyan-400/10 border-cyan-400/40 text-cyan-400":"border-white/10 text-white/40 hover:bg-white/5"}`}>
                    {st==="bars"?"Barras":"Espelho"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Formato</span>
              <select value={s.format} onChange={e=>set({format:e.target.value as Settings["format"]})}
                className="h-9 bg-black/40 border border-white/10 rounded-xl px-3 text-xs text-white focus:outline-none focus:border-cyan-400/40">
                <option value="svg">SVG — slicer 3D</option>
                <option value="png-dark">PNG — fundo escuro</option>
                <option value="png-white">PNG — fundo branco</option>
                <option value="png-transparent">PNG — transparente</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Cor da onda</span>
              <div className="flex gap-1.5 flex-wrap">
                {WAVE_COLORS.map(c=>(
                  <button key={c} onClick={()=>update({waveColor:c})} style={{background:c}}
                    className={`h-8 w-8 rounded-lg border transition hover:scale-110 ${s.waveColor===c?"border-cyan-400 ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#0c0c14]":"border-white/20"}`}/>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Fundo</span>
              <div className="flex gap-1.5 flex-wrap">
                {BG_COLORS.map(c=>(
                  <button key={c} onClick={()=>update({bgColor:c})}
                    style={c==="transparent"?{backgroundImage:"repeating-conic-gradient(#333 0% 25%,#111 0% 50%)",backgroundSize:"10px 10px"}:{background:c}}
                    className={`h-8 w-8 rounded-lg border transition hover:scale-110 ${s.bgColor===c?"border-cyan-400 ring-2 ring-cyan-400 ring-offset-1 ring-offset-[#0c0c14]":"border-white/20"}`}/>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Painel direito ───────────────────────────────────────────────── */}
        <div className="lg:col-span-8 flex flex-col gap-5">

          {/* Preview waveform */}
          <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Preview — Waveform</h2>
            <div className="rounded-xl overflow-hidden border border-white/5">
              <canvas ref={previewRef} style={{width:"100%",height:"90px",display:"block"}}/>
            </div>
          </div>

          {/* Preview chaveiro */}
          <div className="bg-[#0c0c14] border border-white/5 rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Preview — Chaveiro</h2>
            <div className="flex justify-center rounded-xl bg-[#111] border border-white/5 p-6">
              <canvas ref={chaveiroRef} style={{maxWidth:"100%",borderRadius:"8px"}}/>
            </div>
          </div>

          {/* Publicar */}
          {amps.length>0&&(
            <div className="bg-[#0c0c14] border border-cyan-400/10 rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-white/40 flex items-center gap-2">
                  <Send className="h-3.5 w-3.5 text-cyan-400"/>Publicar Memória Sonora
                </h2>
                <p className="mt-1 text-[10px] text-white/25">Sobe o áudio e salva os índices no R2 — scanner decodifica via Viterbi.</p>
              </div>

              {isPublishing&&(
                <div className="flex flex-col gap-2">
                  <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all duration-500" style={{width:`${publishProgress}%`}}/>
                  </div>
                  <p className="text-[10px] font-mono text-white/40">{publishMsg}</p>
                </div>
              )}

              {publishStatus==="done"&&(
                <div className="flex flex-col gap-2 rounded-xl bg-cyan-400/5 border border-cyan-400/15 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0"/>
                    <span className="text-xs text-white font-medium">Publicado! Exporte o SVG e imprima o chaveiro.</span>
                  </div>
                  {playerUrl&&(
                    <a href={playerUrl} target="_blank" rel="noreferrer" className="text-[11px] text-cyan-400 underline font-mono">
                      🎵 jm3d.com.br{playerUrl}
                    </a>
                  )}
                </div>
              )}

              {publishStatus==="error"&&(
                <div className="rounded-xl bg-red-500/5 border border-red-500/15 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-red-400">{publishMsg}</span>
                  {publishMsg.includes("Colisão")&&(
                    <button onClick={handleRegenerateId} disabled={isRegenerating}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                      style={{background:"rgba(0,198,224,0.15)",border:"1px solid rgba(0,198,224,0.3)"}}>
                      <RotateCcw className={`h-3 w-3 ${isRegenerating?"animate-spin":""}`}/>
                      {isRegenerating?"Gerando...":"Novo ID"}
                    </button>
                  )}
                </div>
              )}

              <button onClick={handlePublish}
                disabled={isPublishing||!audioFile||!trackId||!trackNome}
                className="self-start flex items-center gap-2 rounded-xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-black hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]">
                {isPublishing?<><Loader2 className="h-4 w-4 animate-spin"/>Enviando…</>
                  :publishStatus==="done"?<><CheckCircle2 className="h-4 w-4"/>Publicar novamente</>
                  :<><Send className="h-4 w-4"/>Publicar memória sonora</>}
              </button>
            </div>
          )}

          {/* Exportar + Reset */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={exportSVG} disabled={!amps.length}
              className="flex items-center justify-center gap-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30 px-5 py-3 text-sm font-medium text-cyan-400 hover:bg-cyan-400/20 transition disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]">
              <Download className="h-4 w-4"/>SVG
            </button>
            <button onClick={exportPNG} disabled={!amps.length}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium hover:bg-white/10 transition disabled:opacity-30 disabled:cursor-not-allowed min-h-[44px]">
              <Download className="h-4 w-4"/>PNG
            </button>
            <button onClick={reset}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/50 hover:bg-white/10 transition min-h-[44px] sm:ml-auto">
              <RotateCcw className="h-4 w-4"/>Reiniciar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
