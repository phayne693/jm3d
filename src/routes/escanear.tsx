import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Music2, ScanLine, Wifi } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/escanear")({
  component: EscanearPage,
});

type Status = "idle" | "loading" | "ready" | "found" | "error";

/** Track padrão — altere aqui para trocar a música do target AR */
const TARGET_TRACK = "patricia";

/** Elemento A-Frame com tipagem local (evita `as any`) */
interface AFrameElement extends HTMLElement {
  setAttribute(name: string, value: string): void;
}

/** Carrega um script externo com retry e backoff exponencial */
function loadScript(
  src: string,
  retries = 3,
  delay = 1000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => {
      try { document.head.removeChild(script); } catch (_) { /* já removido */ }
      if (retries <= 1) {
        reject(new Error(`Falha ao carregar: ${src}`));
      } else {
        setTimeout(() => {
          loadScript(src, retries - 1, delay * 2).then(resolve).catch(reject);
        }, delay);
      }
    };
    document.head.appendChild(script);
  });
}

export default function EscanearPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scriptLoaded = useRef(false);

  const musicaUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/musica?track=${TARGET_TRACK}`
      : `/musica?track=${TARGET_TRACK}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(musicaUrl)}`;

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    // Injeta CSS para esconder UI padrão do MindAR/A-Frame
    const hideUI = document.createElement("style");
    hideUI.textContent = `
      .mindar-ui-overlay,
      .mindar-ui-scanning,
      .mindar-ui-error,
      .a-loader-title,
      .a-orientation-modal,
      .a-enter-vr,
      [class*="mindar-ui"] { display: none !important; }

      /* Vídeo preenche o container sem distorção — sem position:fixed
         para não escapar do stacking context do root */
      a-scene video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        object-position: center !important;
      }
    `;
    document.head.appendChild(hideUI);

    setStatus("loading");

    loadScript("https://aframe.io/releases/1.4.2/aframe.min.js")
      .then(() =>
        loadScript(
          "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js"
        )
      )
      .then(initScene)
      .catch(() => {
        setStatus("error");
        setErrorMsg(
          "Não foi possível carregar as bibliotecas AR. Verifique sua conexão e tente novamente."
        );
      });

    function initScene() {
      const container = containerRef.current;
      if (!container) return;

      const scene = document.createElement("a-scene") as AFrameElement;
      scene.setAttribute(
        "mindar-image",
        "imageTargetSrc: /targets/waveform.mind; autoStart: true; uiScanning: no; uiLoading: no; uiError: no"
      );
      scene.setAttribute("color-space", "sRGB");
      scene.setAttribute("renderer", "colorManagement: true");
      scene.setAttribute("vr-mode-ui", "enabled: false");
      scene.setAttribute("device-orientation-permission-ui", "enabled: false");
      scene.setAttribute("loading-screen", "enabled: false");
      scene.style.cssText = "position:absolute;inset:0;width:100%;height:100%;z-index:0;";

      const camera = document.createElement("a-camera");
      camera.setAttribute("position", "0 0 0");
      camera.setAttribute("look-controls", "enabled: false");

      const entity = document.createElement("a-entity");
      entity.setAttribute("mindar-image-target", "targetIndex: 0");

      const plane = document.createElement("a-plane");
      plane.setAttribute("position", "0 0 0");
      plane.setAttribute("height", "0.55");
      plane.setAttribute("width", "1.75");
      plane.setAttribute("color", "#000000");
      plane.setAttribute("opacity", "0.0");

      entity.appendChild(plane);
      scene.appendChild(camera);
      scene.appendChild(entity);
      container.appendChild(scene);

      scene.addEventListener("targetFound", () => {
        setStatus("found");
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
        setTimeout(() => {
          window.location.href = `/musica?track=${TARGET_TRACK}`;
        }, 1500);
      });

      scene.addEventListener("arReady", () => setStatus("ready"));

      scene.addEventListener("arError", () => {
        setStatus("error");
        setErrorMsg("Não foi possível acessar a câmera.");
      });
    }
  }, []);

  return (
    <div className="dark fixed inset-0 bg-background overflow-hidden">

      <style>{`
        /* Esconde UI do Mind AR/A-Frame que aparece por cima */
        .mindar-ui-overlay,
        .mindar-ui-scanning,
        .mindar-ui-error,
        .a-loader-title,
        .a-orientation-modal,
        .a-enter-vr,
        [class*="mindar-ui"] { display: none !important; }

        @keyframes scan-line {
          0%   { top: 8%; }
          100% { top: 88%; }
        }
        @keyframes found-flash {
          0%   { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.06); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Câmera AR — absolute dentro do root fixed, mesma origem */}
      <div ref={containerRef} className="absolute inset-0" style={{ zIndex: 0 }} />

      {/* Overlay leve para legibilidade do texto */}
      <div className="absolute inset-0 bg-background/35 pointer-events-none" style={{ zIndex: 1 }} />

      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/30 glass pt-safe">
        <a href="/" className="min-h-[44px] flex items-center">
          <img src={logo} alt="JM3D" className="h-8 w-auto object-contain" />
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-primary" />
          <span>Scanner JM3D</span>
        </div>
      </header>

      {/* Layout principal — 3 zonas: topo / centro / rodapé */}
      <div className="absolute inset-0 flex flex-col items-center z-10 pt-20 px-4 sm:px-6 pointer-events-none" style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom, 0px))" }}>

        {/* Topo: título */}
        <div className="text-center mt-6">
          <h1 className="text-xl font-bold text-foreground drop-shadow-lg">
            {status === "found" ? (
              <span className="inline-flex items-center gap-1.5">
                <Music2 className="h-5 w-5" />
                Waveform reconhecida!
              </span>
            ) : "Aponte para a waveform"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground drop-shadow">
            {status === "found" ? "Abrindo sua música..." : "Aponte o chaveiro para o visor"}
          </p>
        </div>

        {/* Centro: visor de scan — flex-1 + flex para centralizar verticalmente */}
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="relative w-72 h-28">

            {/* Cantos decorativos */}
            {([
              { top: 0,    left: 0,    bt: true,  bl: true  },
              { top: 0,    right: 0,   bt: true,  br: true  },
              { bottom: 0, left: 0,    bb: true,  bl: true  },
              { bottom: 0, right: 0,   bb: true,  br: true  },
            ] as Array<{
              top?: number; bottom?: number; left?: number; right?: number;
              bt?: boolean; bb?: boolean; bl?: boolean; br?: boolean;
            }>).map((pos, i) => (
              <div
                key={i}
                className={`absolute w-6 h-6 transition-all duration-300 ${
                  status === "found"
                    ? "border-primary shadow-[0_0_14px_rgba(0,140,255,0.9)]"
                    : "border-primary/70"
                }`}
                style={{
                  top: pos.top, bottom: pos.bottom,
                  left: pos.left, right: pos.right,
                  borderTopWidth:    pos.bt ? 2 : 0,
                  borderBottomWidth: pos.bb ? 2 : 0,
                  borderLeftWidth:   pos.bl ? 2 : 0,
                  borderRightWidth:  pos.br ? 2 : 0,
                }}
              />
            ))}

            {/* Linha de scan animada */}
            {status === "ready" && (
              <div
                className="absolute left-3 right-3 h-px bg-gradient-to-r from-transparent via-primary to-transparent"
                style={{
                  boxShadow: "0 0 8px rgba(0,140,255,0.9)",
                  animation: "scan-line 2s ease-in-out infinite alternate",
                }}
              />
            )}

            {/* Flash ao reconhecer */}
            {status === "found" && (
              <div
                className="absolute inset-0 rounded border border-primary/60 bg-primary/10"
                style={{ animation: "found-flash 1.5s ease-out forwards" }}
              />
            )}
          </div>
        </div>

        {/* Rodapé: status e ações */}
        <div className="flex flex-col items-center gap-3 pointer-events-auto">

          {(status === "idle" || status === "loading") && (
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-6 w-6 rounded-full border-2 border-border border-t-primary"
                style={{ animation: "spin 0.8s linear infinite" }}
              />
              <p className="text-sm text-muted-foreground">Carregando câmera...</p>
            </div>
          )}

          {status === "ready" && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 glass rounded-full px-4 py-2 border border-primary/20">
                <div
                  className="h-2 w-2 rounded-full bg-primary"
                  style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }}
                />
                <span className="text-xs text-muted-foreground">
                  Câmera ativa — aponte para o chaveiro
                </span>
              </div>
              <a
                href={`/musica?track=${TARGET_TRACK}`}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition min-h-[44px] inline-flex items-center px-2"
              >
                Abrir sem escanear
              </a>
            </div>
          )}

          {status === "found" && (
            <div className="flex items-center gap-2 text-primary font-semibold">
              <ScanLine className="h-5 w-5" />
              Abrindo player...
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                {errorMsg || "Erro ao iniciar câmera"}
              </p>
              <a
                href={`/musica?track=${TARGET_TRACK}`}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 glow-strong transition min-h-[44px]"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir player direto
              </a>
              <div className="flex flex-col items-center gap-2 mt-2">
                <p className="text-xs text-muted-foreground">ou escaneie com sua câmera</p>
                <div className="rounded-xl bg-white p-2">
                  <img src={qrUrl} alt="QR Code" width={120} height={120} className="rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
