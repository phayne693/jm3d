import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type R2Object = {
  arrayBuffer: () => Promise<ArrayBuffer>;
  httpMetadata?: { contentType?: string };
  customMetadata?: Record<string, string>;
};

type R2Bucket = {
  put: (key: string, value: ArrayBuffer, opts?: any) => Promise<any>;
  get: (key: string) => Promise<R2Object | null>;
  list: (opts?: { prefix?: string }) => Promise<{ objects: { key: string; customMetadata?: Record<string,string> }[] }>;
};

type Env = { jm3d_audios?: R2Bucket };

let serverEntryPromise: Promise<ServerEntry> | undefined;
async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => ((m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry)),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try { payload = JSON.parse(body); } catch { return false; }
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return false;
  const fields = payload as Record<string, unknown>;
  if (!["message", "status", "unhandled"].some(k => k in fields)) return false;
  return fields.unhandled === true && fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus);
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) return response;
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

const EXT_MAP: Record<string, string> = {
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/wav": "wav", "audio/x-wav": "wav",
  "audio/m4a": "m4a", "audio/mp4": "m4a",
  "audio/flac": "flac", "audio/x-flac": "flac",
};

const CONTENT_TYPES: Record<string, string> = {
  ogg: "audio/ogg", mp3: "audio/mpeg", wav: "audio/wav",
  m4a: "audio/mp4", flac: "audio/flac",
};

// ─── POST /api/upload ─────────────────────────────────────────────────────────
async function handleUpload(request: Request, env: Env): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ error: "R2 não configurado." }, 503);

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return json({ error: "Requisição inválida." }, 400); }

  const trackId   = String(formData.get("trackId") ?? "").trim().toLowerCase();
  const trackNome = String(formData.get("trackNome") ?? "").trim();
  const audioFile = formData.get("audio") as File | null;

  if (!trackId || !/^[a-z0-9_-]+$/.test(trackId))
    return json({ error: "ID inválido." }, 400);
  if (!trackNome)
    return json({ error: "Nome do cliente é obrigatório." }, 400);
  if (!audioFile || audioFile.size === 0)
    return json({ error: "Arquivo de áudio não encontrado." }, 400);
  if (audioFile.size > 50 * 1024 * 1024)
    return json({ error: "Arquivo muito grande. Máximo 50MB." }, 400);

  const mime    = audioFile.type || "application/octet-stream";
  const ext     = EXT_MAP[mime] ?? audioFile.name.split(".").pop() ?? "ogg";
  const arquivo = `audios/${trackId}.${ext}`;

  await bucket.put(arquivo, await audioFile.arrayBuffer(), {
    httpMetadata: { contentType: mime },
    customMetadata: { trackNome, trackId, ext },
  });

  // Salva amplitudes em JSON separado — scanner compara direto sem recalcular
  const ampsStr = String(formData.get("amps") ?? "[]");
  try {
    const ampsData = JSON.stringify({ amps: JSON.parse(ampsStr), trackNome, trackId });
    await bucket.put(`amps/${trackId}.json`, new TextEncoder().encode(ampsData).buffer, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { trackNome, trackId },
    });
  } catch {}

  return json({
    ok: true, trackId, trackNome, arquivo,
    playerUrl: `/musica?track=${trackId}`,
  });
}

// ─── GET /api/audio/:trackId ──────────────────────────────────────────────────
async function handleAudio(request: Request, env: Env, trackId: string): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ error: "R2 não configurado." }, 503);

  const extensions = ["ogg", "mp3", "wav", "m4a", "flac"];
  let object: R2Object | null = null;
  let contentType = "audio/ogg";

  for (const ext of extensions) {
    object = await bucket.get(`audios/${trackId}.${ext}`);
    if (object) { contentType = CONTENT_TYPES[ext] ?? "audio/octet-stream"; break; }
  }

  if (!object) return json({ error: `Áudio para '${trackId}' não encontrado.` }, 404);

  const body        = await object.arrayBuffer();
  const rangeHeader = request.headers.get("Range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1]);
      const end   = match[2] ? parseInt(match[2]) : body.byteLength - 1;
      const chunk = body.slice(start, end + 1);
      return new Response(chunk, {
        status: 206,
        headers: {
          "Content-Type":   contentType,
          "Content-Range":  `bytes ${start}-${end}/${body.byteLength}`,
          "Accept-Ranges":  "bytes",
          "Content-Length": String(chunk.byteLength),
          "Cache-Control":  "public, max-age=86400",
        },
      });
    }
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type":   contentType,
      "Accept-Ranges":  "bytes",
      "Content-Length": String(body.byteLength),
      "Cache-Control":  "public, max-age=86400",
    },
  });
}

// ─── GET /api/tracks ─────────────────────────────────────────────────────────
async function handleTracksList(env: Env): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ tracks: [] });
  const list = await bucket.list({ prefix: "audios/" });
  const tracks = list.objects.map(obj =>
    obj.key.replace("audios/", "").replace(/\.[^.]+$/, "")
  );
  return json({ ok: true, tracks });
}

// ─── GET /api/next-seq ────────────────────────────────────────────────────────
// Retorna o próximo número sequencial disponível para novo track
async function handleNextSeq(env: Env): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ seq: 1, formatted: "001" });

  const list = await bucket.list({ prefix: "audios/" });
  let maxSeq = 0;

  for (const obj of list.objects) {
    const name = obj.key.replace("audios/", "").replace(/\.[^.]+$/, "");
    // Formato esperado: "001-xxxx"
    const m = name.match(/^(\d+)-[a-z0-9]{4}$/);
    if (m) {
      const n = parseInt(m[1]);
      if (n > maxSeq) maxSeq = n;
    }
  }

  const next = maxSeq + 1;
  return json({ ok: true, seq: next, formatted: String(next).padStart(3, "0") });
}

// ─── GET /api/track-info/:trackId ─────────────────────────────────────────────
// Retorna nome do cliente e metadados de um track
async function handleTrackInfo(env: Env, trackId: string): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ error: "R2 não configurado." }, 503);

  const extensions = ["ogg", "mp3", "wav", "m4a", "flac"];
  for (const ext of extensions) {
    const obj = await bucket.get(`audios/${trackId}.${ext}`);
    if (obj) {
      const meta = obj.customMetadata ?? {};
      return json({
        ok: true,
        trackId,
        trackNome: meta.trackNome ?? trackId,
        ext,
      });
    }
  }
  return json({ error: "Track não encontrado." }, 404);
}

// ─── GET /api/amps — retorna amplitudes de todos os tracks para o scanner ──────
async function handleAmpsList(env: Env): Promise<Response> {
  const bucket = env.jm3d_audios;
  if (!bucket) return json({ tracks: [] });

  const list = await bucket.list({ prefix: "amps/" });
  const tracks: { trackId: string; trackNome: string; amps: number[] }[] = [];

  for (const obj of list.objects) {
    try {
      const item = await bucket.get(obj.key);
      if (!item) continue;
      const text = await item.arrayBuffer().then(b => new TextDecoder().decode(b));
      const data = JSON.parse(text);
      if (data.trackId && data.amps) tracks.push(data);
    } catch {}
  }

  return json({ ok: true, tracks });
}

// ─── Router ───────────────────────────────────────────────────────────────────
async function handleAPIRequest(request: Request, env: Env): Promise<Response | null> {
  const url    = new URL(request.url);
  const path   = url.pathname;
  const method = request.method.toUpperCase();

  if (path === "/api/upload" && method === "POST")
    return handleUpload(request, env);

  if (path === "/api/tracks" && method === "GET")
    return handleTracksList(env);

  if (path === "/api/amps" && method === "GET")
    return handleAmpsList(env);

  if (path === "/api/next-seq" && method === "GET")
    return handleNextSeq(env);

  const infoMatch = path.match(/^\/api\/track-info\/([a-z0-9_-]+)$/i);
  if (infoMatch && method === "GET")
    return handleTrackInfo(env, infoMatch[1]);

  const audioMatch = path.match(/^\/api\/audio\/([a-z0-9_-]+)$/i);
  if (audioMatch && (method === "GET" || method === "HEAD")) {
    if (method === "HEAD") return new Response(null, { status: 200 });
    return handleAudio(request, env, audioMatch[1]);
  }

  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handleAPIRequest(request, env as Env);
      if (apiResponse) return apiResponse;
      const handler  = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};