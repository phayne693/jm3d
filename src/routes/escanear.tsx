import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, ScanLine, Wifi } from "lucide-react";
import logo from "@/assets/jm3d-logo.svg";

export const Route = createFileRoute("/escanear")({
  component: EscanearPage,
});

type Status = "idle" | "loading" | "ready" | "found" | "error";

export default function EscanearPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    // Injeta CSS para esconder TODA a UI padrão do Mind AR / A-Frame
    const hideUI = document.createElement("style");
    hideUI.textContent = `
      .mindar-ui-overlay,
      .mindar-ui-scanning,
      .mindar-ui-error,
      .a-loader-title,
      .a-orientation-modal,
      .a-enter-vr,
      [class*="mindar-ui"] { display: none !important; }
    `;
    document.head.appendChild(hideUI);

    setStatus("loading");

    const aframe = document.createElement("script");
    aframe.src = "https://aframe.io/releases/1.4.2/aframe.min.js";
    aframe.onload = loadMindAR;
    aframe.onerror = () => {
      setStatus("error");
      setErrorMsg("Falha ao carregar biblioteca AR.");
    };
    document.head.appendChild(aframe);

    function loadMindAR() {
      const mind = document.createElement("script");
      mind.src =
        "https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js";
      mind.onload = initScene;
      mind.onerror = () => {
        setStatus("error");
        setErrorMsg("Falha ao carregar Mind AR.");
      };
      document.head.appendChild(mind);
    }

    function initScene() {
      const container = containerRef.current;
      if (!container) return;

      const scene = document.createElement("a-scene") as any;
      scene.setAttribute(
        "mindar-image",
        "imageTargetSrc: /targets/waveform.mind; autoStart: true; uiScanning: no; uiLoading: no; uiError: no"
      );
      scene.setAttribute("color-space", "sRGB");
      scene.setAttribute("renderer", "colorManagement: true");
      scene.setAttribute("vr-mode-ui", "enabled: false");
      scene.setAttribute("device-orientation-permission-ui", "enabled: false");
      scene.setAttribute("loading-screen", "enabled: false");
      scene.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";

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
        setTimeout(() => {
          window.location.href = "/musica?track=patricia";
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

      {/* Câmera AR — ocupa tudo por baixo */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Overlay leve para legibilidade do texto */}
      <div className="absolute inset-0 bg-background/35 pointer-events-none" />

      {/* Header */}
      <header className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-6 py-4 border-b border-border/30 glass">
        <a href="/">
          <img src={logo} alt="JM3D" className="h-8 w-auto object-contain" />
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wifi className="h-3.5 w-3.5 text-primary" />
          <span>Scanner JM3D</span>
        </div>
      </header>

      {/* Layout principal — 3 zonas: topo / centro / rodapé */}
      <div className="absolute inset-0 flex flex-col items-center z-10 pt-20 pb-10 px-6 pointer-events-none">

        {/* Topo: título */}
        <div className="text-center mt-6">
          <h1 className="text-xl font-bold text-foreground drop-shadow-lg">
            {status === "found" ? "🎵 Waveform reconhecida!" : "Aponte para a waveform"}
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
                href="/musica?track=patricia"
                className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground transition"
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
                href="/musica?track=patricia"
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-strong transition"
              >
                <MessageCircle className="h-4 w-4" />
                Abrir player direto
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
