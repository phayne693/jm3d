import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, Music2, MessageCircle, ScanLine } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/escanear")({ component: EscanearPage });

type Status = "idle" | "requesting-camera" | "scanning" | "found" | "error";
interface TrackData { trackId: string; trackNome: string; amps: number[]; }

// ─── Constantes ───────────────────────────────────────────────────────────────
const NUM_BARS       = 18;
const MIN_BARS       = 10;
const CONF_THRESHOLD = 0.35;
const ALPHA          = 0.80;
const MIN_AMP        = 0.25;
const MAX_AMP        = 1.0;
const LEVEL_VALUES   = [0.25, 0.50, 0.75, 1.0];

// ─── Acumulação ───────────────────────────────────────────────────────────────
interface Accum { amps: number[]; conf: number[]; count: number[]; }
function makeAccum(): Accum {
  return { amps: new Array(NUM_BARS).fill(0), conf: new Array(NUM_BARS).fill(0), count: new Array(NUM_BARS).fill(0) };
}
function accumulate(acc: Accum, amps: number[], conf: number[]): void {
  for (let i=0; i<NUM_BARS; i++) {
    const a=amps[i], c=conf[i];
    if (!isFinite(a)||c<0.20) continue;
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

// ─── Quantização ──────────────────────────────────────────────────────────────
function quantizeLevel(amp: number): number {
  return LEVEL_VALUES.reduce((b,lv)=>Math.abs(lv-amp)<Math.abs(b-amp)?lv:b);
}

// ─── Viterbi Decoder ──────────────────────────────────────────────────────────
const VG1=0b10011, VG2=0b11101;
function vbBits(n:number):number{let c=0;while(n){c+=n&1;n>>=1;}return c;}
function vbGray(n:number):number{return n^(n>>1);}
function ampToBits(amp:number):[number,number]{
  const idx=LEVEL_VALUES.indexOf(quantizeLevel(amp));
  const gray=vbGray(idx)%4;
  return [(gray>>1)&1, gray&1];
}
function viterbi(amps:number[]):{errors:number;bits:number[]}{
  const data=amps.slice(1,-1);
  const obs:number[]=[];
  for(const a of data){const[b1,b0]=ampToBits(a);obs.push(b1,b0);}
  const INF=1e9;
  let dp=new Map<number,{cost:number;path:number[]}>();
  dp.set(0,{cost:0,path:[]});
  const steps=Math.floor(obs.length/2);
  for(let t=0;t<steps;t++){
    const nd=new Map<number,{cost:number;path:number[]}>();
    for(const[st,{cost,path}] of dp){
      for(const ib of [0,1]){
        const ns=((st<<1)|ib)&0b11111;
        const o1=vbBits(ns&VG1)%2, o2=vbBits(ns&VG2)%2;
        const e=(t*2<obs.length&&o1!==obs[t*2]?1:0)+(t*2+1<obs.length&&o2!==obs[t*2+1]?1:0);
        const nc=cost+e; const ex=nd.get(ns);
        if(!ex||nc<ex.cost) nd.set(ns,{cost:nc,path:[...path,ib]});
      }
    }
    dp=nd;
  }
  let best={cost:INF,path:[] as number[]};
  for(const v of dp.values()) if(v.cost<best.cost) best=v;
  return {errors:best.cost,bits:best.path};
}

// ─── Match por índices + Viterbi ──────────────────────────────────────────────
function matchDirect(measured:number[], tracks:TrackData[]):{trackId:string;trackNome:string;score:number}|null{
  if(!measured.length||!tracks.length) return null;
  const measuredIdx=measured.map(a=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
  const {bits:mBits}=viterbi(measured);

  const results=tracks.map(t=>{
    const isIdx=t.amps.every((v:number)=>v>=0&&v<=3&&Number.isInteger(v));
    const tIdx:number[]=isIdx?t.amps:t.amps.map((a:number)=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
    const tAmps:number[]=tIdx.map((i:number)=>LEVEL_VALUES[i]??MIN_AMP);
    const {bits:tBits}=viterbi(tAmps);
    const nb=Math.min(mBits.length,tBits.length);
    let bm=0; for(let i=0;i<nb;i++) if(mBits[i]===tBits[i]) bm++;
    let im=0;
    for(let i=0;i<Math.min(measuredIdx.length,tIdx.length);i++)
      if(measuredIdx[i]===tIdx[i]) im++;
    return {trackId:t.trackId,trackNome:t.trackNome,score:im/NUM_BARS,exactMatches:im};
  }).sort((a,b)=>b.score-a.score);

  const best=results[0] as any, second=results[1];
  const margin=best.score-(second?.score??0);
  if(tracks.length===1) return best.exactMatches>=10?best:null;
  if(best.exactMatches>=11&&margin>=0.11) return best;
  return null;
}

// ─── Detector de barras ───────────────────────────────────────────────────────
function detectBars(imageData:ImageData, W:number, H:number):{amps:number[];conf:number[];waveStart:number;waveEnd:number}|null{
  const {data}=imageData;
  const gray=new Float32Array(W*H);
  const rg=new Float32Array(W*H);
  const sat=new Float32Array(W*H);
  for(let i=0;i<W*H;i++){
    const p=i*4,r=data[p],g=data[p+1],b=data[p+2];
    gray[i]=r*0.299+g*0.587+b*0.114; rg[i]=r-g;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
    sat[i]=mx>0?(mx-mn)/mx:0;
  }
  const scanTop=Math.floor(H*0.08), scanBot=Math.floor(H*0.92), scanH=scanBot-scanTop;
  let minG=255,maxG=0,sG=0,sRG=0,sSat=0,sG2=0,sRG2=0,sSat2=0,n=0;
  for(let y=scanTop;y<scanBot;y+=4) for(let x=0;x<W;x+=4){
    const i=y*W+x;
    if(gray[i]<minG)minG=gray[i]; if(gray[i]>maxG)maxG=gray[i];
    sG+=gray[i];sG2+=gray[i]**2;sRG+=rg[i];sRG2+=rg[i]**2;sSat+=sat[i];sSat2+=sat[i]**2;n++;
  }
  if(maxG-minG<25) return null;
  const stdG=Math.sqrt(Math.max(0,sG2/n-(sG/n)**2));
  const stdRG=Math.sqrt(Math.max(0,sRG2/n-(sRG/n)**2));
  const stdSat=Math.sqrt(Math.max(0,sSat2/n-(sSat/n)**2))*255;
  const work=new Float32Array(W*H); let workThresh:number;
  if(stdRG>=stdG&&stdRG>=stdSat){
    for(let i=0;i<W*H;i++) work[i]=Math.max(0,128-rg[i]); workThresh=30;
  } else if(stdSat>=stdG){
    for(let i=0;i<W*H;i++) work[i]=(1-sat[i])*255; workThresh=120;
  } else {
    const midThreshold=minG+(maxG-minG)*0.30;
    const bright=sG/n<128;
    for(let i=0;i<W*H;i++)
      work[i]=bright?Math.min(255,Math.max(0,(gray[i]-midThreshold)*3)):Math.min(255,Math.max(0,(midThreshold-gray[i])*3));
    workThresh=40;
  }
  const colH=new Float32Array(W);
  for(let x=0;x<W;x++){
    let run=0,mr=0;
    for(let y=scanTop;y<scanBot;y++){if(work[y*W+x]>workThresh){run++;if(run>mr)mr=run;}else run=0;}
    colH[x]=mr;
  }
  const kSize=Math.max(2,Math.floor(W/120));
  const sm=new Float32Array(W);
  for(let x=0;x<W;x++){
    let s=0,c=0;
    for(let k=-kSize;k<=kSize;k++){const xi=x+k;if(xi>=0&&xi<W){const w=(kSize+1)-Math.abs(k);s+=colH[xi]*w;c+=w;}}
    sm[x]=s/c;
  }
  const maxH=Math.max(...Array.from(sm));
  if(maxH<scanH*0.05) return null;
  const gapThresh=maxH*0.12;
  const bs:number[]=[],be:number[]=[]; let inBar=false;
  for(let x=0;x<W;x++){
    const isBar=sm[x]>gapThresh;
    if(isBar&&!inBar){bs.push(x);inBar=true;}
    if(!isBar&&inBar){be.push(x-1);inBar=false;}
  }
  if(inBar) be.push(W-1);
  const minW=W*0.003;
  const bC:number[]=[],bH:number[]=[];
  for(let k=0;k<Math.min(bs.length,be.length);k++){
    const s=bs[k],e=be[k];
    if(e-s<1||(e-s)<minW) continue;
    let pk=0; for(let x=s;x<=e;x++) if(sm[x]>pk) pk=sm[x];
    bC.push((s+e)/2); bH.push(pk);
  }
  const minGap=W/(NUM_BARS*2.2);
  const fC:number[]=[],fH:number[]=[];
  for(let k=0;k<bC.length;k++){
    if(!fC.length||bC[k]-fC[fC.length-1]>minGap){fC.push(bC[k]);fH.push(bH[k]);}
    else if(bH[k]>fH[fH.length-1]){fC[fC.length-1]=bC[k];fH[fH.length-1]=bH[k];}
  }
  if(fC.length<NUM_BARS-2||fC.length>NUM_BARS+2) return null;
  const sps:number[]=[]; for(let k=1;k<fC.length;k++) sps.push(fC[k]-fC[k-1]);
  const meanSp=sps.reduce((a,b)=>a+b,0)/sps.length;
  const stdSp=Math.sqrt(sps.reduce((a,b)=>a+(b-meanSp)**2,0)/sps.length);
  if(stdSp/meanSp>0.35) return null;
  let fHfinal=fH;
  if(fC.length!==NUM_BARS){
    fHfinal=[];
    for(let k=0;k<NUM_BARS;k++){
      const t=(k/(NUM_BARS-1))*(fH.length-1);
      const idx=Math.floor(t),frac=t-idx;
      fHfinal.push(fH[idx]+(fH[Math.min(idx+1,fH.length-1)]-fH[idx])*frac);
    }
  }
  const normalized=fHfinal.map(h=>MIN_AMP+((h-Math.min(...fHfinal))/(Math.max(...fHfinal)-Math.min(...fHfinal)||1))*(MAX_AMP-MIN_AMP));
  const barConf=fC.map((_,k)=>{
    if(k===0||k===fC.length-1) return 0.8;
    const sp=fC[k]-fC[k-1];
    return Math.max(0,Math.min(1,1-Math.abs(sp-meanSp)/meanSp*2));
  });
  const barConfFinal=fHfinal===fH?barConf:fHfinal.map((_,k)=>{
    const t=(k/(NUM_BARS-1))*(barConf.length-1);
    const idx=Math.floor(t);
    return barConf[idx]+(barConf[Math.min(idx+1,barConf.length-1)]-barConf[idx])*(t-idx);
  });
  return {amps:normalized,conf:barConfFinal,waveStart:fC[0],waveEnd:fC[NUM_BARS-1]};
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
  const tracksRef  =useRef<TrackData[]>([]);
  const failCount  =useRef(0);

  const [status,      setStatus]     =useState<Status>("idle");
  const [errorMsg,    setErrorMsg]   =useState("");
  const [tracksCount, setTracksCount]=useState(0);
  const [confidence,  setConfidence] =useState(0);
  const [detecting,   setDetecting]  =useState(false);
  const [debugLog,    setDebugLog]   =useState<string[]>([]);
  const [showDebug,   setShowDebug]  =useState(false);
  const debugRef=useRef<string[]>([]);

  function addLog(msg:string){
    const ts=new Date().toLocaleTimeString("pt-BR",{hour12:false});
    const line=`${ts} ${msg}`;
    debugRef.current=[line,...debugRef.current].slice(0,45);
    setDebugLog([...debugRef.current]);
  }

  useEffect(()=>{
    fetch("/api/amps").then(r=>r.json()).then((d:any)=>{
      const t=d.tracks??[];
      tracksRef.current=t; setTracksCount(t.length);
      addLog(`📦 ${t.length} track(s): ${t.map((x:any)=>x.trackId).join(", ")||"nenhum"}`);
    }).catch(e=>addLog(`❌ Erro: ${e}`));
  },[]);

  useEffect(()=>{ startScanner(); return ()=>cleanup(); },[]);

  function cleanup(){
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t=>t.stop());
  }

  async function startScanner(){
    if(initialized.current) return;
    initialized.current=true; setStatus("requesting-camera");
    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}}
      });
      const vtrack=stream.getVideoTracks()[0];
      const caps=vtrack.getCapabilities?.() as any;
      if(caps?.focusMode) try{await vtrack.applyConstraints({advanced:[{focusMode:"continuous"} as any]});}catch{}
      if(caps?.exposureMode) try{await vtrack.applyConstraints({advanced:[{exposureMode:"continuous"} as any]});}catch{}
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
      setStatus("scanning"); loop();
    }catch(e:any){
      setStatus("error");
      setErrorMsg(e?.name==="NotAllowedError"?"Permissão de câmera negada.":"Câmera indisponível.");
    }
  }

  const loop=useCallback(()=>{
    const video=videoRef.current,canvas=canvasRef.current;
    if(!video||!canvas||video.readyState<2){rafRef.current=requestAnimationFrame(loop);return;}
    const W=canvas.width,H=canvas.height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true})!;
    ctx.drawImage(video,0,0,W,H);
    const roiW=Math.floor(W*0.90),roiH=Math.floor(H*0.18);
    const roiX=Math.floor((W-roiW)/2),roiY=Math.floor((H-roiH)/2);
    const imageData=ctx.getImageData(roiX,roiY,roiW,roiH);
    const detected=detectBars(imageData,roiW,roiH);
    if(detected){
      setDetecting(true);
      accumulate(accumRef.current,detected.amps,detected.conf);
      const ready=readyCount(accumRef.current);
      setConfidence(Math.round((ready/NUM_BARS)*50));
      const currentTracks=tracksRef.current;
      if(ready>=MIN_BARS&&currentTracks.length>0){
        const measuredAmps=getAmps(accumRef.current);
        // Debug Viterbi
        const measuredIdx=measuredAmps.map(a=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
        const {bits:decBits,errors:decErr}=viterbi(measuredAmps);
        const bitsStr=decBits.slice(0,10).join('')+(decBits.length>10?'…':'');
        const vitRanking=currentTracks.map(t=>{
          const isIdx=t.amps.every((v:number)=>v>=0&&v<=3&&Number.isInteger(v));
          const tAmps:number[]=isIdx?t.amps.map((i:number)=>LEVEL_VALUES[i]??MIN_AMP):t.amps;
          const {bits:tBits}=viterbi(tAmps);
          const tIdx=isIdx?t.amps:t.amps.map((a:number)=>LEVEL_VALUES.indexOf(quantizeLevel(a)));
          let im=0; for(let i=0;i<Math.min(measuredIdx.length,tIdx.length);i++) if(measuredIdx[i]===tIdx[i]) im++;
          const nb=Math.min(decBits.length,tBits.length);
          let bm=0; for(let i=0;i<nb;i++) if(decBits[i]===tBits[i]) bm++;
          return{id:t.trackId,im,bm,nb};
        }).sort((a,b)=>b.im-a.im);
        const vTop=vitRanking[0];
        addLog(`🔬 bits=${bitsStr} erros=${decErr} → ${vTop?.id||'?'} (${vTop?.im||0}/18 idx, ${vTop?.bm||0}/${vTop?.nb||0} bits)`);
        addLog(`🔎 buscando "${vTop?.id||'?'}" no R2… ${currentTracks.find(t=>t.trackId===vTop?.id)?'✓ encontrado':'✗ não encontrado'}`);
        const match=matchDirect(measuredAmps,currentTracks);
        if(match){
          failCount.current=0;
          readingsRef.current.push(match);
          if(readingsRef.current.length>3) readingsRef.current.shift();
          const votes:Record<string,number>={};
          for(const r of readingsRef.current) votes[r.trackId]=(votes[r.trackId]??0)+1;
          const [topTrack,topCount]=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
          setConfidence(50+Math.round((topCount/2)*49));
          addLog(`✓ ${topTrack} (${topCount}/2 votos)`);
          if(topCount>=2){
            setConfidence(100); setStatus("found");
            addLog(`🎵 CONFIRMADO: ${topTrack}`);
            if(navigator.vibrate) navigator.vibrate([80,40,160]);
            setTimeout(()=>{window.location.href=`/musica?track=${topTrack}`;},400); return;
          }
        } else {
          failCount.current++;
          if(failCount.current>=2){
            accumRef.current=makeAccum(); readingsRef.current=[]; failCount.current=0; setConfidence(0);
          }
        }
      }
    } else { setDetecting(false); }
    rafRef.current=requestAnimationFrame(loop);
  },[]);

  useEffect(()=>{
    if(tracksCount>0&&status==="scanning"){
      cancelAnimationFrame(rafRef.current);
      rafRef.current=requestAnimationFrame(loop);
    }
  },[tracksCount,loop,status]);

  const retry=()=>{
    cleanup(); initialized.current=false;
    readingsRef.current=[]; accumRef.current=makeAccum(); failCount.current=0;
    setStatus("idle"); setErrorMsg(""); setConfidence(0); setDetecting(false);
    setTimeout(()=>startScanner(),300);
  };

  const phase=confidence>=70?"confirming":detecting?"reading":"waiting";

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden flex flex-col select-none">
      <style>{`
        @keyframes scanline{0%{top:15%}100%{top:80%}}
        @keyframes pulse-ring{0%{transform:scale(1);opacity:.6}100%{transform:scale(1.2);opacity:0}}
        @keyframes fade-up{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fade-up{animation:fade-up .35s ease forwards}
      `}</style>

      {/* Câmera backdrop */}
      <div className="absolute inset-0 z-0">
        <video ref={videoRef}
          className="w-full h-full object-cover opacity-50"
          style={{filter:"blur(0.5px)"}}
          playsInline muted autoPlay/>
        <canvas ref={canvasRef} className="hidden"/>
        <div className="absolute inset-0" style={{
          background:"linear-gradient(to bottom,rgba(0,0,0,0.7) 0%,transparent 25%,transparent 70%,rgba(0,0,0,0.9) 100%)"
        }}/>
      </div>

      {/* Conteúdo */}
      <div className="relative z-10 flex flex-col min-h-screen p-5">

        {/* Header */}
        <header className="flex items-center justify-between mb-auto">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="JM3D" className="h-6 w-auto"/>
            <div className="h-3.5 w-px bg-white/20"/>
            <span className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-medium">Memory Scanner</span>
          </div>
          {tracksCount>0&&(
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
              <span className="text-[10px] font-mono text-cyan-400">{tracksCount} memória{tracksCount>1?"s":""}</span>
            </div>
          )}
        </header>

        {/* Centro */}
        <div className="flex flex-col items-center justify-center flex-1 gap-8 py-12">

          {/* Mensagem */}
          <div className="text-center min-h-[52px] flex flex-col items-center justify-center gap-1">
            {status==="found"?(
              <div className="fade-up flex flex-col items-center gap-1">
                <Music2 className="h-6 w-6 text-green-400"/>
                <h2 className="text-xl font-semibold text-green-400">Memória reconhecida</h2>
                <p className="text-xs text-green-400/60">Abrindo sua música...</p>
              </div>
            ):status==="requesting-camera"?(
              <h2 className="text-lg font-medium text-white/50">Iniciando câmera...</h2>
            ):status==="error"?(
              <h2 className="text-lg font-medium text-red-400">Erro de câmera</h2>
            ):(
              <>
                <h2 className="text-xl font-semibold text-white">
                  {phase==="confirming"?"Identificando..."
                    :phase==="reading"?"Lendo waveform..."
                    :"Aponte para o chaveiro"}
                </h2>
                <p className="text-xs text-white/40">
                  {phase==="confirming"?"Aguarde um instante"
                    :phase==="reading"?"Mantenha o celular fixo"
                    :"Alinhe a waveform na tela"}
                </p>
              </>
            )}
          </div>

          {/* Visor com reticle */}
          <div className="relative w-72 h-28 rounded-2xl border border-white/10 bg-black/30 backdrop-blur-sm overflow-hidden shadow-2xl flex items-center justify-center">
            {/* Scan line */}
            {phase==="reading"&&(
              <div className="absolute inset-x-4 h-px bg-cyan-400/70 shadow-[0_0_10px_#00c6e0]"
                style={{animation:"scanline 1.2s ease-in-out infinite alternate",willChange:"top"}}/>
            )}
            {/* Ícone central */}
            <div className={`w-14 h-14 rounded-full flex items-center justify-center border transition-all duration-500 ${
              phase==="confirming"?"border-green-400 bg-green-500/15 shadow-[0_0_30px_rgba(74,222,128,0.2)]"
              :phase==="reading"?"border-cyan-400/60 bg-cyan-500/10"
              :"border-white/15 bg-white/5"}`}>
              {status==="requesting-camera"?(
                <div className="h-5 w-5 rounded-full border-2 border-white/20 border-t-cyan-400 animate-spin"/>
              ):status==="found"?(
                <Music2 className="h-6 w-6 text-green-400"/>
              ):phase==="reading"?(
                <div className="flex items-center gap-0.5">
                  {[0.4,0.7,1,0.6,0.9,0.5,0.8].map((h,i)=>(
                    <div key={i} className="rounded-full bg-cyan-400/80"
                      style={{width:2.5,height:Math.floor(h*22),opacity:0.5+h*0.5}}/>
                  ))}
                </div>
              ):(
                <Camera className="h-5 w-5 text-white/25"/>
              )}
            </div>
            {/* Cantos */}
            {(["tl","tr","bl","br"] as const).map(pos=>(
              <div key={pos} className="absolute" style={{
                top:pos.startsWith("t")?10:"auto",
                bottom:pos.startsWith("b")?10:"auto",
                left:pos.endsWith("l")?10:"auto",
                right:pos.endsWith("r")?10:"auto",
                width:16,height:16,
                borderTop:pos.startsWith("t")?"2px solid rgba(255,255,255,0.25)":"none",
                borderBottom:pos.startsWith("b")?"2px solid rgba(255,255,255,0.25)":"none",
                borderLeft:pos.endsWith("l")?"2px solid rgba(255,255,255,0.25)":"none",
                borderRight:pos.endsWith("r")?"2px solid rgba(255,255,255,0.25)":"none",
                borderRadius:pos==="tl"?"3px 0 0 0":pos==="tr"?"0 3px 0 0":pos==="bl"?"0 0 0 3px":"0 0 3px 0",
              }}/>
            ))}
            {/* Pulse ring quando confirming */}
            {phase==="confirming"&&(
              <div className="absolute inset-2 rounded-xl border border-green-400/30"
                style={{animation:"pulse-ring 1s ease-out infinite"}}/>
            )}
          </div>

          {/* Progresso */}
          {confidence>0&&status==="scanning"&&(
            <div className="flex flex-col items-center gap-2">
              <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{
                    width:`${confidence}%`,
                    background:confidence>=70?"#4ade80":"#00c6e0"
                  }}/>
              </div>
              <span className="text-xs font-mono"
                style={{color:confidence>=70?"#4ade80":"rgba(0,198,224,0.7)"}}>
                {confidence}%
              </span>
            </div>
          )}

          <p className="text-[11px] text-white/25 font-mono tracking-wide">
            Mantenha a câmera a cerca de 15cm
          </p>
        </div>

        {/* Erro */}
        {status==="error"&&(
          <div className="flex flex-col items-center gap-3 mb-8">
            <p className="text-sm text-white/50 text-center">{errorMsg}</p>
            <button onClick={retry}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium text-white"
              style={{background:"rgba(0,198,224,0.15)",border:"1px solid rgba(0,198,224,0.3)"}}>
              <Camera className="h-4 w-4"/>Tentar novamente
            </button>
          </div>
        )}
      </div>

      {/* Debug */}
      <button onClick={()=>setShowDebug(v=>!v)}
        className="fixed bottom-6 right-4 z-30 text-[10px] font-mono px-3 py-1.5 rounded-full"
        style={{background:"rgba(0,0,0,0.75)",color:"rgba(0,198,224,0.6)",border:"1px solid rgba(0,198,224,0.15)"}}>
        {showDebug?"✕ fechar":"⚙ debug"}
      </button>
      {showDebug&&(
        <div className="fixed bottom-0 left-0 right-0 z-30 max-h-56 overflow-y-auto"
          style={{background:"rgba(3,3,8,0.97)",borderTop:"1px solid rgba(0,198,224,0.15)"}}>
          <div className="px-4 pt-3 pb-1 flex justify-between items-center border-b border-white/5">
            <span className="text-xs font-mono font-bold text-cyan-400">Terminal JM3D</span>
            <span className="text-[10px] text-white/30 font-mono">{tracksCount} tracks · {status}</span>
          </div>
          <div className="px-4 py-2 flex flex-col gap-0.5">
            {debugLog.map((line,i)=>(
              <p key={i} className="text-[11px] font-mono" style={{
                color:line.includes("🎵")||line.includes("✓")?"#4ade80"
                  :line.includes("✗")||line.includes("↺")?"#f87171"
                  :line.includes("🔬")||line.includes("🔎")?"#00c6e0"
                  :"rgba(255,255,255,0.5)"}}>
                {line}
              </p>
            ))}
          </div>
          <div className="px-4 pb-3">
            <button onClick={()=>{debugRef.current=[];setDebugLog([]);}}
              className="text-[10px] text-white/20 font-mono">limpar</button>
          </div>
        </div>
      )}
    </div>
  );
}
