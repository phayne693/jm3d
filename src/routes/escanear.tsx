import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Music2, MessageCircle, ScanLine } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/escanear")({
  component: EscanearPage,
});

type Status = "idle" | "requesting-camera" | "scanning" | "found" | "error";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface TrackData { trackId: string; trackNome: string; amps: number[]; }

// ─── Acumulação ───────────────────────────────────────────────────────────────
const NUM_BARS       = 25;
const CONF_THRESHOLD = 0.45;
const MIN_BARS       = 20;
const ALPHA          = 0.85;
const MIN_AMP        = 0.12;
const MAX_AMP        = 1.0;

interface Accum { amps: number[]; conf: number[]; count: number[]; }

function makeAccum(): Accum {
  return { amps: new Array(NUM_BARS).fill(0), conf: new Array(NUM_BARS).fill(0), count: new Array(NUM_BARS).fill(0) };
}
function accumulate(acc: Accum, amps: number[], conf: number[]): void {
  for (let i=0; i<NUM_BARS; i++) {
    const a=amps[i], c=conf[i];
    if (!isFinite(a)||c<0.25) continue;
    if (acc.count[i]===0) { acc.amps[i]=a; acc.conf[i]=c; }
    else {
      const tw=acc.conf[i]+c*ALPHA;
      acc.amps[i]=(acc.amps[i]*acc.conf[i]+a*c*ALPHA)/tw;
      acc.conf[i]=Math.min(1,acc.conf[i]+c*0.42);
    }
    acc.count[i]++;
  }
}
function readyCount(acc: Accum): number { return acc.conf.filter(c=>c>=CONF_THRESHOLD).length; }
function getAmps(acc: Accum): number[] { return acc.amps.map((a,i)=>acc.conf[i]>=CONF_THRESHOLD?a:MIN_AMP); }

// ─── Match direto por amplitudes do R2 ───────────────────────────────────────
function matchDirect(measured: number[], tracks: TrackData[]): {trackId:string;trackNome:string;score:number}|null {
  if (!measured.length||!tracks.length) return null;
  const mMin=Math.min(...measured), mMax=Math.max(...measured), mRange=mMax-mMin||1;
  const results=tracks.map(t=>{
    const e=t.amps;
    const eMin=Math.min(...e), eMax=Math.max(...e), eRange=eMax-eMin||1;
    let score=0;
    for (let i=0;i<NUM_BARS;i++) {
      const mN=(measured[i]-mMin)/mRange;
      const eN=(e[i]-eMin)/eRange;
      score+=Math.max(0,1-Math.abs(mN-eN)*2.4);
    }
    return {trackId:t.trackId, trackNome:t.trackNome, score:score/NUM_BARS};
  }).sort((a,b)=>b.score-a.score);
  const best=results[0], second=results[1];
  const margin=best.score-(second?.score??0);
  if (tracks.length===1) return best.score>=0.50?best:null;
  if (best.score>=0.55&&margin>=0.20) return best;
  return null;
}

// ─── Detector ────────────────────────────────────────────────────────────────
function detectBars(imageData: ImageData, W: number, H: number): {amps:number[];conf:number[];waveStart:number;waveEnd:number}|null {
  const {data}=imageData;
  const gray=new Float32Array(W*H);
  const rg=new Float32Array(W*H);
  const sat=new Float32Array(W*H);
  for (let i=0;i<W*H;i++) {
    const p=i*4,r=data[p],g=data[p+1],b=data[p+2];
    gray[i]=r*0.299+g*0.587+b*0.114;
    rg[i]=r-g;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    sat[i]=mx>0?(mx-mn)/mx:0;
  }
  const scanTop=Math.floor(H*0.15), scanBot=Math.floor(H*0.85), scanH=scanBot-scanTop;
  let sG=0,sRG=0,sSat=0,sG2=0,sRG2=0,sSat2=0,n=0;
  for (let y=scanTop;y<scanBot;y+=4) for (let x=0;x<W;x+=4) {
    const i=y*W+x;
    sG+=gray[i];sG2+=gray[i]**2;
    sRG+=rg[i];sRG2+=rg[i]**2;
    sSat+=sat[i];sSat2+=sat[i]**2;
    n++;
  }
  const stdG=Math.sqrt(Math.max(0,sG2/n-(sG/n)**2));
  const stdRG=Math.sqrt(Math.max(0,sRG2/n-(sRG/n)**2));
  const stdSat=Math.sqrt(Math.max(0,sSat2/n-(sSat/n)**2))*255;
  const work=new Float32Array(W*H);
  let workThresh: number;
  if (stdRG>=stdG&&stdRG>=stdSat) {
    for (let i=0;i<W*H;i++) work[i]=Math.max(0,128-rg[i]);
    workThresh=30;
  } else if (stdSat>=stdG) {
    for (let i=0;i<W*H;i++) work[i]=(1-sat[i])*255;
    workThresh=120;
  } else {
    const avgG=sG/n; const bright=avgG<128;
    const thresh=avgG+(bright?18:-18);
    for (let i=0;i<W*H;i++) {
      work[i]=bright?Math.min(255,Math.max(0,(gray[i]-thresh)*3)):Math.min(255,Math.max(0,(thresh-gray[i])*3));
    }
    workThresh=40;
  }
  const colH=new Float32Array(W);
  for (let x=0;x<W;x++) {
    let sum=0;
    for (let y=scanTop;y<scanBot;y++) if (work[y*W+x]>workThresh) sum++;
    colH[x]=sum;
  }
  const kSize=Math.max(1,Math.floor(W/80));
  const sm=new Float32Array(W);
  for (let x=0;x<W;x++) {
    let s=0,c=0;
    for (let k=-kSize;k<=kSize;k++) { const xi=x+k; if(xi>=0&&xi<W){s+=colH[xi];c++;} }
    sm[x]=s/c;
  }
  const maxH=Math.max(...Array.from(sm));
  if (maxH<scanH*0.06) return null;
  const minSig=maxH*0.08;
  let waveStart=0, waveEnd=W-1;
  for (let x=0;x<W;x++) { if(sm[x]>minSig){waveStart=x;break;} }
  for (let x=W-1;x>=0;x--) { if(sm[x]>minSig){waveEnd=x;break;} }
  const waveWidth=waveEnd-waveStart;
  if (waveWidth<W*0.20) return null;
  const radius=Math.max(3,Math.floor(waveWidth/(NUM_BARS*2.8)));
  const amps: number[]=[];
  for (let i=0;i<NUM_BARS;i++) {
    const x=Math.floor(waveStart+(i/(NUM_BARS-1))*waveWidth);
    let s=0,c=0;
    for (let dx=-radius;dx<=radius;dx++) { const xi=Math.max(0,Math.min(W-1,x+dx)); s+=sm[xi];c++; }
    amps.push(s/c);
  }
  const aMin=Math.min(...amps),aMax=Math.max(...amps),aRange=aMax-aMin;
  if (aRange<maxH*0.04) return null;
  const normalized=amps.map(a=>MIN_AMP+((a-aMin)/aRange)*(MAX_AMP-MIN_AMP));
  const barConf: number[]=[];
  for (let i=0;i<NUM_BARS;i++) {
    const x=Math.floor(waveStart+(i/(NUM_BARS-1))*waveWidth);
    const vals: number[]=[];
    for (let dx=-radius;dx<=radius;dx++) vals.push(sm[Math.max(0,Math.min(W-1,x+dx))]);
    const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
    const variance=vals.reduce((a,b)=>a+(b-mean)**2,0)/vals.length;
    const cv=mean>0?Math.sqrt(variance)/mean:1;
    barConf.push(Math.max(0,Math.min(1,1-cv*1.6)));
  }
  return {amps:normalized,conf:barConf,waveStart,waveEnd};
}

// ─── Componente ───────────────────────────────────────────────────────────────
function EscanearPage() {
  const videoRef   =useRef<HTMLVideoElement>(null);
  const canvasRef  =useRef<HTMLCanvasElement>(null);
  const streamRef  =useRef<MediaStream|null>(null);
  const rafRef     =useRef<number>(0);
  const initialized=useRef(false);
  const readingsRef=useRef<{trackId:string;trackNome:string;score:number}[]>([]);
  const accumRef   =useRef<Accum>(makeAccum());
  const lastRegion =useRef<{start:number;end:number}|null>(null);

  const [status,     setStatus]    =useState<Status>("idle");
  const [errorMsg,   setErrorMsg]  =useState("");
  const [tracks,     setTracks]    =useState<TrackData[]>([]);
  const [confidence, setConfidence]=useState(0);
  const [detecting,  setDetecting] =useState(false);
  const [debugLog,   setDebugLog]  =useState<string[]>([]);
  const [showDebug,  setShowDebug] =useState(false);
  const debugRef=useRef<string[]>([]);

  const WHATSAPP="https://wa.me/5511940677064?text=Ol%C3%A1%20JM3D%2C%20quero%20minha%20mem%C3%B3ria%20sonora";

  function addLog(msg: string) {
    const ts=new Date().toLocaleTimeString("pt-BR",{hour12:false});
    const line=`${ts} ${msg}`;
    debugRef.current=[line,...debugRef.current].slice(0,30);
    setDebugLog([...debugRef.current]);
  }

  useEffect(()=>{
    fetch("/api/amps").then(r=>r.json()).then((d:any)=>{
      const t=d.tracks??[];
      setTracks(t);
      addLog(`📦 ${t.length} track(s): ${t.map((x:any)=>x.trackId).join(", ")||"nenhum"}`);
    }).catch((e)=>addLog(`❌ Erro: ${e}`));
  },[]);

  useEffect(()=>{ startScanner(); return ()=>cleanup(); },[]);

  function cleanup() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
  }

  async function startScanner() {
    if (initialized.current) return;
    initialized.current=true;
    setStatus("requesting-camera");
    try {
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}
      });
      const vtrack=stream.getVideoTracks()[0];
      const caps=vtrack.getCapabilities?.() as any;
      if (caps?.focusMode) {
        try{await vtrack.applyConstraints({advanced:[{focusMode:"continuous"} as any]});}catch{}
      }
      streamRef.current=stream;
      const video=videoRef.current!;
      video.srcObject=stream; video.playsInline=true; video.muted=true;
      await video.play();
      await new Promise<void>(res=>{
        if(video.videoWidth>0){res();return;}
        video.addEventListener("loadedmetadata",()=>res(),{once:true});
      });
      canvasRef.current!.width=video.videoWidth;
      canvasRef.current!.height=video.videoHeight;
      setStatus("scanning");
      loop();
    } catch(e:any) {
      setStatus("error");
      setErrorMsg(e?.name==="NotAllowedError"?"Permissão de câmera negada.":"Câmera indisponível.");
    }
  }

  const loop=useCallback(()=>{
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas||video.readyState<2){
      rafRef.current=requestAnimationFrame(loop);return;
    }
    const W=canvas.width,H=canvas.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true})!;
    ctx.drawImage(video,0,0,W,H);

    const roiW=Math.floor(W*0.90);
    const roiH=Math.floor(H*0.28);
    const roiX=Math.floor((W-roiW)/2);
    const roiY=Math.floor((H-roiH)/2);
    const imageData=ctx.getImageData(roiX,roiY,roiW,roiH);
    const detected=detectBars(imageData,roiW,roiH);

    if (detected) {
      setDetecting(true);
      const last=lastRegion.current;
      if (!last||Math.abs(detected.waveStart-last.start)>8||Math.abs(detected.waveEnd-last.end)>8) {
        lastRegion.current={start:detected.waveStart,end:detected.waveEnd};
      }
      accumulate(accumRef.current,detected.amps,detected.conf);
      const ready=readyCount(accumRef.current);
      setConfidence(Math.round((ready/NUM_BARS)*70));

      if (ready>=MIN_BARS&&tracks.length>0) {
        const measuredAmps=getAmps(accumRef.current);
        const scores=tracks.map(t=>{
          const mMin=Math.min(...measuredAmps),mMax=Math.max(...measuredAmps),mRange=mMax-mMin||1;
          const eMin=Math.min(...t.amps),eMax=Math.max(...t.amps),eRange=eMax-eMin||1;
          let sc=0;
          for(let i=0;i<NUM_BARS;i++){
            sc+=Math.max(0,1-Math.abs((measuredAmps[i]-mMin)/mRange-(t.amps[i]-eMin)/eRange)*2.4);
          }
          return {id:t.trackId,score:sc/NUM_BARS};
        }).sort((a,b)=>b.score-a.score);
        addLog(`📊 ${ready}/25 | Top: ${scores[0]?.id} ${(scores[0]?.score*100).toFixed(0)}% | 2o: ${scores[1]?.id||'-'} ${((scores[1]?.score||0)*100).toFixed(0)}%`);

        const match=matchDirect(measuredAmps,tracks);
        if (match) {
          readingsRef.current.push(match);
          if(readingsRef.current.length>4) readingsRef.current.shift();
          const votes:Record<string,number>={};
          for(const r of readingsRef.current) votes[r.trackId]=(votes[r.trackId]??0)+1;
          const [topTrack,topCount]=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
          setConfidence(70+Math.round((topCount/3)*29));
          addLog(`✓ ${topTrack} (${topCount}/3 votos)`);
          if(topCount>=3){
            setConfidence(100);
            setStatus("found");
            addLog(`🎵 CONFIRMADO: ${topTrack}`);
            if(navigator.vibrate) navigator.vibrate([80,40,160]);
            setTimeout(()=>{window.location.href=`/musica?track=${topTrack}`;},400);
            return;
          }
        } else {
          accumRef.current=makeAccum();
          readingsRef.current=[];
          setConfidence(0);
          addLog(`✗ Sem match — resetando`);
        }
      }
    } else {
      setDetecting(false);
      lastRegion.current=null;
    }
    rafRef.current=requestAnimationFrame(loop);
  },[tracks]);

  useEffect(()=>{
    if(tracks.length>0&&status==="scanning"){
      cancelAnimationFrame(rafRef.current);
      rafRef.current=requestAnimationFrame(loop);
    }
  },[tracks,loop,status]);

  const retry=()=>{
    cleanup();
    initialized.current=false;
    readingsRef.current=[];
    accumRef.current=makeAccum();
    lastRegion.current=null;
    setStatus("idle");setErrorMsg("");setConfidence(0);setDetecting(false);
    setTimeout(()=>startScanner(),300);
  };

  // Progresso em 3 fases
  const phase = confidence>=70?"confirming":confidence>0?"reading":"waiting";

  return (
    <div className="dark fixed inset-0 overflow-hidden" style={{background:"#050810"}}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.15);opacity:0}}
        @keyframes fade-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-in{animation:fade-in .4s ease forwards}
      `}</style>

      {/* Câmera — sem overlay de linhas, só o vídeo limpo */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-70"
        style={{zIndex:0}} playsInline muted autoPlay/>
      <canvas ref={canvasRef} className="hidden"/>

      {/* Gradiente suave no topo e base */}
      <div className="absolute inset-0 pointer-events-none" style={{
        zIndex:1,
        background:"linear-gradient(to bottom, rgba(5,8,16,0.85) 0%, transparent 30%, transparent 70%, rgba(5,8,16,0.95) 100%)"
      }}/>

      {/* Header limpo */}
      <header className="absolute top-0 inset-x-0 z-20 px-5 py-4 flex items-center justify-between">
        <a href="/" className="min-h-[44px] flex items-center">
          <img src={logo} alt="JM3D" className="h-7 w-auto"/>
        </a>
        {tracks.length>0&&(
          <div className="text-xs font-mono px-2.5 py-1 rounded-full"
            style={{background:"rgba(0,198,224,0.08)",color:"rgba(0,198,224,0.6)",border:"1px solid rgba(0,198,224,0.15)"}}>
            {tracks.length} memória{tracks.length>1?"s":""}
          </div>
        )}
      </header>

      {/* UI principal — centralizada e limpa */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-between py-28 px-6">

        {/* Título */}
        <div className="text-center">
          {status==="found"?(
            <div className="fade-in flex flex-col items-center gap-2">
              <Music2 className="h-8 w-8 text-cyan-400"/>
              <h1 className="text-xl font-semibold text-white">Memória reconhecida</h1>
              <p className="text-sm text-cyan-400">Abrindo sua música...</p>
            </div>
          ):status==="requesting-camera"?(
            <h1 className="text-lg font-medium text-white/70">Iniciando câmera...</h1>
          ):status==="error"?(
            <h1 className="text-lg font-medium text-red-400">Erro de câmera</h1>
          ):(
            <div className="flex flex-col items-center gap-1">
              <h1 className="text-xl font-semibold text-white">
                {phase==="confirming"?"Identificando..."
                  :detecting?"Lendo waveform"
                  :"Aponte para o chaveiro"}
              </h1>
              <p className="text-sm text-white/40">
                {phase==="confirming"?"Aguarde um instante"
                  :detecting?"Mantendo o foco..."
                  :"Centralize a waveform na tela"}
              </p>
            </div>
          )}
        </div>

        {/* Indicador central — círculo simples e limpo */}
        <div className="flex flex-col items-center gap-8">

          {/* Círculo de progresso */}
          <div className="relative flex items-center justify-center" style={{width:160,height:160}}>

            {/* Ring de fundo */}
            <svg className="absolute inset-0" width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="68" fill="none"
                stroke="rgba(0,198,224,0.08)" strokeWidth="2"/>
              {/* Arco de progresso */}
              <circle cx="80" cy="80" r="68" fill="none"
                stroke={confidence>=70?"#00ffaa":"rgba(0,198,224,0.7)"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${(confidence/100)*427} 427`}
                transform="rotate(-90 80 80)"
                style={{transition:"stroke-dasharray 0.4s ease, stroke 0.4s ease"}}/>
            </svg>

            {/* Anel de pulse quando confirmando */}
            {phase==="confirming"&&(
              <div className="absolute inset-0 rounded-full border border-cyan-400/30"
                style={{animation:"pulse-ring 1.2s ease-out infinite"}}/>
            )}

            {/* Ícone central */}
            <div className="relative flex items-center justify-center rounded-full"
              style={{
                width:88, height:88,
                background: status==="found"
                  ?"rgba(0,255,170,0.12)"
                  :detecting
                    ?"rgba(0,198,224,0.08)"
                    :"rgba(255,255,255,0.04)",
                border: status==="found"
                  ?"1px solid rgba(0,255,170,0.3)"
                  :detecting
                    ?"1px solid rgba(0,198,224,0.2)"
                    :"1px solid rgba(255,255,255,0.08)",
                transition:"all 0.4s ease",
              }}>

              {status==="requesting-camera"?(
                <div className="h-7 w-7 rounded-full border-2 border-white/20 border-t-cyan-400"
                  style={{animation:"spin 0.8s linear infinite"}}/>
              ):status==="found"?(
                <Music2 className="h-8 w-8 text-cyan-400"/>
              ):detecting?(
                <div className="flex flex-col items-center gap-0.5">
                  {/* Mini waveform animada no centro — só 5 barras, sem movimento lateral */}
                  <div className="flex items-center gap-1">
                    {[0.4,0.7,1,0.6,0.8,0.5,0.9,0.7,0.4].map((h,i)=>(
                      <div key={i} className="rounded-full"
                        style={{
                          width:3,
                          height:Math.floor(h*28),
                          background:"rgba(0,198,224,0.7)",
                          opacity: 0.5 + h*0.5,
                        }}/>
                    ))}
                  </div>
                </div>
              ):(
                <Camera className="h-7 w-7 text-white/30"/>
              )}
            </div>

            {/* Porcentagem */}
            {confidence>0&&status==="scanning"&&(
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs font-mono"
                style={{color: confidence>=70?"#00ffaa":"rgba(0,198,224,0.7)"}}>
                {confidence}%
              </div>
            )}
          </div>

          {/* Mensagem de fase */}
          {status==="scanning"&&(
            <div className="flex flex-col items-center gap-1 text-center">
              {phase==="waiting"&&(
                <p className="text-xs text-white/30">Mantenha o chaveiro à cerca de 15cm</p>
              )}
              {phase==="reading"&&(
                <p className="text-xs text-cyan-400/70">
                  {readyCount(accumRef.current)}/{NUM_BARS} barras acumuladas
                </p>
              )}
              {phase==="confirming"&&(
                <p className="text-xs text-white/50">Confirmando leitura...</p>
              )}
            </div>
          )}
        </div>

        {/* Botões de erro / rodapé */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          {status==="error"&&(
            <>
              <p className="text-sm text-white/50 text-center">{errorMsg}</p>
              <button onClick={retry}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-medium text-white min-h-[44px]"
                style={{background:"rgba(0,198,224,0.12)",border:"1px solid rgba(0,198,224,0.25)"}}>
                <Camera className="h-4 w-4"/>Tentar novamente
              </button>
              <a href={WHATSAPP} target="_blank" rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold text-white min-h-[44px]"
                style={{background:"rgba(0,198,224,0.85)"}}>
                <MessageCircle className="h-4 w-4"/>Falar com a JM3D
              </a>
            </>
          )}
          {status==="found"&&(
            <div className="flex items-center gap-2 text-sm text-cyan-400/70">
              <ScanLine className="h-4 w-4"/>Abrindo player...
            </div>
          )}
        </div>
      </div>

      {/* Debug — compacto, canto inferior direito */}
      <button onClick={()=>setShowDebug(v=>!v)}
        className="fixed bottom-6 right-4 z-30 text-xs font-mono px-3 py-1.5 rounded-full"
        style={{background:"rgba(0,0,0,0.6)",color:"rgba(0,198,224,0.5)",border:"1px solid rgba(0,198,224,0.15)"}}>
        {showDebug?"✕ debug":"debug"}
      </button>

      {showDebug&&(
        <div className="fixed bottom-0 left-0 right-0 z-30 max-h-56 overflow-y-auto"
          style={{background:"rgba(0,0,0,0.95)",borderTop:"1px solid rgba(0,198,224,0.15)"}}>
          <div className="px-4 pt-3 pb-1 flex justify-between items-center">
            <span className="text-xs font-mono text-cyan-400">debug</span>
            <span className="text-xs text-white/30 font-mono">{tracks.length} tracks</span>
          </div>
          <div className="px-4 pb-3 flex flex-col gap-0.5">
            {debugLog.map((line,i)=>(
              <p key={i} className="text-xs font-mono"
                style={{color:line.includes("✓")||line.includes("🎵")?"#00ffaa":line.includes("✗")?"#ff6b6b":"rgba(255,255,255,0.5)"}}>
                {line}
              </p>
            ))}
          </div>
          <div className="px-4 pb-3">
            <button onClick={()=>{debugRef.current=[];setDebugLog([]);}}
              className="text-xs text-white/20 font-mono">limpar</button>
          </div>
        </div>
      )}
    </div>
  );
}
