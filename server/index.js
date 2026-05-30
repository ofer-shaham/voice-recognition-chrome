const express = require("express");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const { ytPlayerData, fetchSrt } = require("./services/youtube-transcript");
const { fetchTtsAudio } = require("./services/tts-proxy");

const app = express();
const PORT = process.env.PORT || 3001;
const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";
const SERVER_START = Date.now();

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
    { name: "TTS",         description: "Text-to-speech proxy" },
    { name: "AI",          description: "OpenRouter chat proxy" },
    { name: "Health",      description: "Server status" },
  ],
  paths: {
    "/api/transcript/languages": {
      get: {
        tags: ["Transcripts"],
        summary: "List available caption languages for a video",
        parameters: [{ name: "videoId", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language list and video metadata" }, 400: { description: "Missing videoId" }, 500: { description: "YouTube fetch error" } },
      },
    },
    "/api/srt": {
      get: {
        tags: ["Transcripts"],
        summary: "Fetch a transcript as SRT text",
        parameters: [
          { name: "videoId", in: "query", required: true, schema: { type: "string" } },
          { name: "lang", in: "query", required: false, schema: { type: "string", example: "en" } },
          { name: "method", in: "query", required: false, schema: { type: "string", enum: ["1", "2"] } },
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
    "/api/health":     { get: { tags: ["Health"], summary: "Server liveness check", responses: { 200: { description: "Server is up" } } } },
    "/api/config":     { get: { tags: ["Health"], summary: "Check whether the server has an API key configured", responses: { 200: { description: "Key presence flag" } } } },
    "/api/chat":       { post: { tags: ["AI"], summary: "OpenRouter chat completions proxy", responses: { 200: { description: "OpenRouter response" }, 401: { description: "No API key" }, 500: { description: "OpenRouter error" } } } },
  },
};

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Transcript API Docs",
  swaggerOptions: { defaultModelsExpandDepth: -1 },
}));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

const log = (level, msg, meta = {}) => {
  const rest = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  console.log(`[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}${rest}`);
};

app.use((req, _res, next) => { log("info", `${req.method} ${req.path}`); next(); });
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
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
  try {
    const data   = await ytPlayerData(String(videoId));
    const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const vd     = data?.videoDetails || {};
    log("info", "transcript/languages OK", { videoId, n: tracks.length });
    res.json({
      videoDetails: {
        title: vd.title || null, author: vd.author || null,
        lengthSeconds: vd.lengthSeconds || null, videoId: vd.videoId || videoId,
      },
      availableLanguages: tracks.map(t => ({
        languageCode: t.languageCode,
        name: t.name?.simpleText || t.languageCode,
        isAutoGenerated: t.kind === "asr",
      })),
    });
  } catch (e) {
    log("error", "transcript/languages failed", { videoId, error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// ── SRT fetch ─────────────────────────────────────────────────────────────────
app.get("/api/srt", async (req, res) => {
  const { videoId, lang, method } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId is required" });
  const langCode = String(lang || "en").split("-")[0];
  try {
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
    const data    = await orRes.json();
    const rawList = data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
    const models  = rawList.map((m) => ({ id: m.slug || m.id || "", label: m.name || m.short_name || m.slug || "" })).filter((m) => m.id);
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
    const data  = await orRes.json();
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
    const data    = await orRes.json();
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
