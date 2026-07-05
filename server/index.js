const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { ytPlayerData, fetchSrt, fetchVideoInfoDownsub } = require("./services/youtube-transcript");

async function fetchTranslatedSrt(videoId, langCode, targetLang) {
  const downstream = "https://youtube-dl-jrte.onrender.com";
  const url = new URL(`${downstream}/api/translate-transcript`);
  url.searchParams.set("videoID", videoId);
  url.searchParams.set("language", langCode);
  url.searchParams.set("targetLanguage", targetLang);
  url.searchParams.set("type", "srt");

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Translate API HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }

  const text = await res.text();
  if (!text.includes("-->")) {
    throw new Error("Translated transcript did not contain valid SRT content");
  }
  return text;
}
const { fetchTtsAudio } = require("./services/tts-proxy");

const app = express();
const PORT = process.env.PORT || 3001;
const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";
const SERVER_START = Date.now();

// ── In-memory log buffer ───────────────────────────────────────────────────────
const LOG_BUFFER_MAX = 200;
const logBuffer = [];
let logSeq = 0;

const formatAge = (ms) => {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

// ── Swagger / OpenAPI spec ─────────────────────────────────────────────────────
const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "YouTube Transcript & TTS API",
    version: "1.0.0",
    description:
      "Server-side proxy for YouTube transcript fetching, language discovery, " +
      "Google TTS, and OpenRouter AI chat.",
  },
  servers: [{ url: "/", description: "This server (port 3001 proxied)" }],
  tags: [
    { name: "Transcripts", description: "YouTube caption / SRT endpoints" },
    { name: "TTS", description: "Text-to-speech proxy" },
    { name: "AI", description: "OpenRouter chat proxy" },
    { name: "Health", description: "Server status" },
  ],
  paths: {
    "/api/transcript/languages": {
      get: {
        tags: ["Transcripts"],
        summary: "List available caption languages for a video (DownSub API, falls back to YouTube player data)",
        parameters: [{ name: "videoId", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language list, video metadata, and a server-designated defaultLanguageCode" }, 400: { description: "Missing videoId" }, 500: { description: "YouTube fetch error" } },
      },
    },
    "/api/srt": {
      get: {
        tags: ["Transcripts"],
        summary: "Fetch a transcript as SRT text",
        parameters: [
          { name: "videoId", in: "query", required: true, schema: { type: "string" } },
          { name: "lang", in: "query", required: false, schema: { type: "string", example: "en" } },
          { name: "method", in: "query", required: false, schema: { type: "string", enum: ["1", "2", "3", "4"] }, description: "1=youtube-transcript-plus (deprecated, requires Node>=20), 2=youtube-transcript-api-js, 3=ytInitialPlayerResponse+json3 (downsub-style), 4=DownSub-hosted API (default)" },
        ],
        responses: { 200: { description: "SRT-formatted transcript" }, 400: { description: "Missing videoId" }, 500: { description: "All fetch methods failed" } },
      },
    },
    "/api/tts": {
      get: {
        tags: ["TTS"],
        summary: "Google TTS audio proxy",
        parameters: [
          { name: "text", in: "query", required: true, schema: { type: "string" } },
          { name: "lang", in: "query", required: true, schema: { type: "string", example: "en" } },
        ],
        responses: { 200: { description: "MP3 audio data" }, 400: { description: "Missing text or lang" }, 500: { description: "TTS upstream error" } },
      },
    },
    "/api/health": { get: { tags: ["Health"], summary: "Server liveness check", responses: { 200: { description: "Server is up" } } } },
    "/api/config": { get: { tags: ["Health"], summary: "Check whether the server has an API key configured", responses: { 200: { description: "Key presence flag" } } } },
    "/api/chat": { post: { tags: ["AI"], summary: "OpenRouter chat completions proxy", responses: { 200: { description: "OpenRouter response" }, 401: { description: "No API key" }, 500: { description: "OpenRouter error" } } } },
    "/api/logs": {
      get: {
        tags: ["Health"],
        summary: "Server request logs (in-memory ring buffer, last 200 entries)",
        parameters: [{ name: "since", in: "query", required: false, schema: { type: "integer" }, description: "Return only entries with id > since (for incremental polling)" }],
        responses: {
          200: {
            description: "Log entries",
            content: {
              "application/json": {
                schema: {
                  type: "object", properties: {
                    entries: {
                      type: "array", items: {
                        type: "object", properties: {
                          id: { type: "integer" },
                          ts: { type: "string", format: "date-time" },
                          level: { type: "string", enum: ["INFO", "WARN", "ERROR"] },
                          msg: { type: "string" },
                          meta: { type: "object" },
                        }
                      }
                    },
                    maxId: { type: "integer" },
                  }
                }
              },
            },
          },
        },
      },
    },
  },
};

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const SWAGGER_DARK_CSS = `
  body { background:#0d1117!important; }
  .swagger-ui { color:#c9d1d9; background:#0d1117; }
  .swagger-ui .topbar { background:#161b29; border-bottom:1px solid #21262d; padding:8px 0; }
  .swagger-ui .topbar a { color:#58a6ff; }
  .swagger-ui .info .title,
  .swagger-ui .info h1,
  .swagger-ui .info h2,
  .swagger-ui .info h3 { color:#e6edf3; }
  .swagger-ui .info p,
  .swagger-ui .info li { color:#8b949e; }
  .swagger-ui .info a { color:#58a6ff; }
  .swagger-ui .scheme-container { background:#0d1117; box-shadow:none; border-bottom:1px solid #21262d; }
  .swagger-ui select { background:#161b29; color:#c9d1d9; border-color:#30363d; }
  .swagger-ui input[type=text],
  .swagger-ui textarea { background:#0d1117; color:#c9d1d9; border-color:#30363d; }
  .swagger-ui input[type=text]:focus,
  .swagger-ui textarea:focus { border-color:#58a6ff; outline:none; }
  .swagger-ui .opblock { border-color:#21262d!important; background:#161b29; border-radius:6px; margin-bottom:8px; }
  .swagger-ui .opblock .opblock-summary { border-color:#21262d; }
  .swagger-ui .opblock .opblock-summary-operation-id,
  .swagger-ui .opblock .opblock-summary-path,
  .swagger-ui .opblock .opblock-summary-path__deprecated,
  .swagger-ui .opblock .opblock-summary-description { color:#c9d1d9; }
  .swagger-ui .opblock .opblock-section-header { background:#1c2128; border-color:#30363d; }
  .swagger-ui .opblock .opblock-section-header h4 { color:#e6edf3; }
  .swagger-ui .opblock.opblock-get { border-color:#1f6feb!important; background:#0d1e36; }
  .swagger-ui .opblock.opblock-get .opblock-summary { border-color:#1f6feb; background:#0d1e36; }
  .swagger-ui .opblock.opblock-post { border-color:#238636!important; background:#0d2818; }
  .swagger-ui .opblock.opblock-post .opblock-summary { border-color:#238636; background:#0d2818; }
  .swagger-ui .opblock.opblock-put { border-color:#9e6a03!important; background:#271d04; }
  .swagger-ui .opblock.opblock-delete { border-color:#b91c1c!important; background:#2d1010; }
  .swagger-ui .opblock-tag { color:#e6edf3; border-color:#21262d; }
  .swagger-ui .opblock-tag:hover { background:#161b29; }
  .swagger-ui .opblock-tag small { color:#8b949e; }
  .swagger-ui .tab li { color:#8b949e; }
  .swagger-ui .tab li.active { color:#e6edf3; }
  .swagger-ui table thead tr td,
  .swagger-ui table thead tr th { color:#8b949e; border-color:#21262d; }
  .swagger-ui .parameter__name { color:#c9d1d9; }
  .swagger-ui .parameter__type { color:#79c0ff; }
  .swagger-ui .parameter__deprecated { color:#f85149; }
  .swagger-ui .parameter__in { color:#56d364; }
  .swagger-ui table.model tr td { color:#c9d1d9; border-color:#21262d; }
  .swagger-ui .response-col_status { color:#c9d1d9; }
  .swagger-ui .response-col_description { color:#8b949e; }
  .swagger-ui .responses-inner h4,
  .swagger-ui .responses-inner h5 { color:#e6edf3; }
  .swagger-ui .response .response-col_description__inner { color:#8b949e; }
  .swagger-ui section.models { border-color:#21262d; background:#0d1117; }
  .swagger-ui section.models h4 { color:#e6edf3; }
  .swagger-ui section.models .model-container { background:#161b29; border-color:#30363d; }
  .swagger-ui .model { color:#c9d1d9; }
  .swagger-ui .model-title { color:#e6edf3; }
  .swagger-ui .model .property.primitive { color:#79c0ff; }
  .swagger-ui .btn { border-color:#30363d; color:#c9d1d9; background:#21262d; }
  .swagger-ui .btn:hover { background:#30363d; }
  .swagger-ui .btn.execute { background:#1f6feb; border-color:#1f6feb; color:#fff; }
  .swagger-ui .btn.execute:hover { background:#388bfd; }
  .swagger-ui .btn.cancel { background:#b91c1c; border-color:#b91c1c; color:#fff; }
  .swagger-ui .btn.authorize { background:#238636; border-color:#238636; color:#fff; }
  .swagger-ui .loading-container .loading::after { border-color:#58a6ff transparent #58a6ff transparent; }
  .swagger-ui .markdown p,
  .swagger-ui .markdown li { color:#8b949e; }
  .swagger-ui .markdown code,
  .swagger-ui .renderedMarkdown code { background:#161b29; color:#79c0ff; padding:2px 6px; border-radius:4px; }
  .swagger-ui .highlight-code { background:#161b29; }
  .swagger-ui .microlight { background:#161b29!important; color:#c9d1d9; }
  .swagger-ui .copy-to-clipboard { background:#21262d; }
  .swagger-ui .copy-to-clipboard button { background:#21262d; }
  .swagger-ui .arrow { fill:#8b949e; }
  .swagger-ui svg.arrow { fill:#8b949e; }
  .swagger-ui .expand-methods svg,
  .swagger-ui .expand-operation svg { fill:#8b949e; }
  .swagger-ui .servers > label { color:#8b949e; }
  .swagger-ui .servers > label select { background:#161b29; color:#c9d1d9; border-color:#30363d; }
  .swagger-ui .auth-wrapper .authorize { border-color:#238636; }
  .swagger-ui .dialog-ux .modal-ux { background:#161b29; border-color:#30363d; }
  .swagger-ui .dialog-ux .modal-ux-header { background:#1c2128; border-color:#30363d; }
  .swagger-ui .dialog-ux .modal-ux-header h3 { color:#e6edf3; }
  .swagger-ui .dialog-ux .modal-ux-content { color:#c9d1d9; }
`;

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Transcript API Docs",
  customCss: SWAGGER_DARK_CSS,
  swaggerOptions: { defaultModelsExpandDepth: -1 },
}));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

const log = (level, msg, meta = {}) => {
  const rest = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}${rest}`);
  logBuffer.unshift({ id: ++logSeq, ts, level: level.toUpperCase(), msg, meta });
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.length = LOG_BUFFER_MAX;
};

app.use((req, _res, next) => { log("info", `${req.method} ${req.path}`); next(); });
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// ── Server logs ───────────────────────────────────────────────────────────────
app.get("/api/logs", (req, res) => {
  const since = parseInt(req.query.since || "0", 10);
  const entries = since ? logBuffer.filter(e => e.id > since) : logBuffer;
  res.json({ entries, maxId: logBuffer[0]?.id || 0 });
});

// ── Health ─────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  const now = Date.now();
  res.json({ ok: true, timestamp: now, startedAt: SERVER_START, age: formatAge(now - SERVER_START), uptime: Math.floor(process.uptime()) });
});

app.get("/api/config", (_req, res) => res.json({ serverHasKey: !!ENV_KEY }));

// ── Transcript languages ───────────────────────────────────────────────────────
app.get("/api/transcript/languages", async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId is required" });

  // Default: DownSub-hosted API — also returns a server-designated default language.
  try {
    const data = await fetchVideoInfoDownsub(String(videoId));
    log("info", "transcript/languages OK (downsub)", { videoId, n: data.availableLanguages.length, default: data.defaultLanguageCode });
    return res.json(data);
  } catch (e) {
    log("warn", "transcript/languages downsub failed, falling back", { videoId, error: e.message });
  }

  // Fallback: parse ytInitialPlayerResponse / Innertube directly.
  try {
    const data = await ytPlayerData(String(videoId));
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const vd = data?.videoDetails || {};
    log("info", "transcript/languages OK (fallback)", { videoId, n: tracks.length });
    res.json({
      videoDetails: {
        title: vd.title || null, author: vd.author || null,
        lengthSeconds: vd.lengthSeconds || null, videoId: vd.videoId || videoId,
      },
      availableLanguages: tracks.map((t, i) => ({
        languageCode: t.languageCode,
        name: t.name?.simpleText || t.languageCode,
        isAutoGenerated: t.kind === "asr",
        isDefault: i === 0,
      })),
      defaultLanguageCode: tracks[0]?.languageCode || null,
    });
  } catch (e) {
    log("error", "transcript/languages failed", { videoId, error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── SRT fetch ─────────────────────────────────────────────────────────────────
app.get("/api/srt", async (req, res) => {
  const { videoId, lang, method, targetLang } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId is required" });
  const langCode = String(lang || "en").split("-")[0];
  try {
    const translateTarget = String(targetLang || "").trim();
    if (translateTarget) {
      const translated = await fetchTranslatedSrt(String(videoId), langCode, translateTarget);
      log("info", "SRT translated OK", { videoId, lang: langCode, targetLang: translateTarget, method: method || "auto" });
      res.type("text/plain; charset=utf-8").send(translated);
      return;
    }

    const srt = await fetchSrt(String(videoId), langCode, method);
    log("info", "SRT OK", { videoId, lang: langCode, method: method || "auto" });
    res.type("text/plain; charset=utf-8").send(srt);
  } catch (e) {
    log("error", "SRT failed", { videoId, lang: langCode, error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── TTS proxy ─────────────────────────────────────────────────────────────────
app.get("/api/tts", async (req, res) => {
  const { text, lang } = req.query;
  if (!text || !lang) return res.status(400).json({ error: "text and lang are required" });
  try {
    const buf = await fetchTtsAudio(text, lang);
    log("info", "TTS OK", { lang: String(lang).split("-")[0], bytes: buf.length });
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err) {
    log("warn", "TTS failed", { error: err.message, status: err.status });
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Free models ───────────────────────────────────────────────────────────────
app.get("/api/free-models", async (_req, res) => {
  try {
    const orRes = await fetch(
      "https://openrouter.ai/api/frontend/models/find?active=true&fmt=cards&max_price=0&order=top-weekly",
      { headers: { Accept: "application/json" } },
    );
    if (!orRes.ok) return res.status(orRes.status).json({ error: "OpenRouter returned " + orRes.status });
    const data = await orRes.json();
    const rawList = data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
    const models = rawList.map((m) => ({ id: m.slug || m.id || "", label: m.name || m.short_name || m.slug || "" })).filter((m) => m.id);
    res.json({ models });
  } catch (err) {
    log("error", "free-models fetch failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── AI health check ───────────────────────────────────────────────────────────
app.post("/api/health_ai", async (req, res) => {
  const key = (req.body || {}).apiKey || ENV_KEY;
  if (!key) return res.status(401).json({ ok: false, error: "No API key available." });
  const t0 = Date.now();
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "http://localhost:5000", "X-Title": "Voice Translation App" },
      body: JSON.stringify({ model: "meta-llama/llama-3.1-8b-instruct:free", messages: [{ role: "user", content: "Reply with the single word: OK" }], max_tokens: 5 }),
    });
    const elapsed = Date.now() - t0;
    if (!orRes.ok) {
      const body = await orRes.text().catch(() => "");
      return res.json({ ok: false, status: orRes.status, error: body.slice(0, 200), elapsed, timestamp: Date.now() });
    }
    const data = await orRes.json();
    const reply = data?.choices?.[0]?.message?.content || "";
    return res.json({ ok: true, elapsed, reply, timestamp: Date.now() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, elapsed: Date.now() - t0, timestamp: Date.now() });
  }
});

// ── Chat proxy ────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, model, apiKey, maxTokens } = req.body || {};
  if (!Array.isArray(messages) || !model) {
    return res.status(400).json({ error: "messages (array) and model (string) are required" });
  }
  const key = apiKey || ENV_KEY;
  if (!key) return res.status(401).json({ error: "No API key available. Set OPENROUTER_API_KEY, or enter one in the UI." });

  const orBody = { model, messages };
  if (maxTokens && Number.isInteger(maxTokens) && maxTokens > 0) orBody.max_tokens = maxTokens;

  const t0 = Date.now();
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`, "Content-Type": "application/json",
        "HTTP-Referer": req.headers.referer || req.headers.origin || "http://localhost:5000",
        "X-Title": "Voice Translation App",
      },
      body: JSON.stringify(orBody),
    });
    const elapsed = Date.now() - t0;
    if (!orRes.ok) {
      const body = await orRes.text().catch(() => "");
      log("error", "OpenRouter error", { status: orRes.status, elapsed });
      return res.status(orRes.status).json({ error: `OpenRouter ${orRes.status}: ${body || orRes.statusText}` });
    }
    const data = await orRes.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return res.status(500).json({ error: "No content in OpenRouter response" });
    const keySuffix = key.length > 4 ? `...${key.slice(-4)}` : "***";
    log("info", "OpenRouter OK", { model, elapsed, promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens });
    res.json({ content, model: data?.model || model, keySuffix });
  } catch (err) {
    log("error", "OpenRouter fetch failed", { error: err.message, elapsed: Date.now() - t0 });
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  log("info", `Server listening on port ${PORT}`);
  log("info", `API key source: ${ENV_KEY ? "OPENROUTER_API_KEY env var" : "none (UI must provide key)"}`);
});
