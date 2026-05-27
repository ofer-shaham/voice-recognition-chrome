const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const ENV_KEY =
  process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";

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

// ── middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// ── structured logger ─────────────────────────────────────────────────────────
const log = (level, msg, meta = {}) => {
  const ts = new Date().toISOString();
  const rest = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}${rest}`);
};

// ── request logger middleware ─────────────────────────────────────────────────
app.use((req, _res, next) => {
  log("info", `${req.method} ${req.path}`);
  next();
});

// ── middleware: prevent caching on all API routes ──────────────────────────────
app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

// ── health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  const now = Date.now();
  res.json({
    ok: true,
    timestamp: now,
    startedAt: SERVER_START,
    age: formatAge(now - SERVER_START),
    uptime: Math.floor(process.uptime()),
  });
});

// ── config (lets client know if server has a key) ────────────────────────────
app.get("/api/config", (_req, res) => {
  res.json({ serverHasKey: !!ENV_KEY });
});

// ── health_ai: verify the OpenRouter key actually works ───────────────────────
app.post("/api/health_ai", async (req, res) => {
  const { apiKey } = req.body || {};
  const key = apiKey || ENV_KEY;

  if (!key) {
    return res.status(401).json({
      ok: false,
      error:
        "No API key available. Set OPENROUTER_API_KEY on the server or pass one in the request body.",
    });
  }

  const t0 = Date.now();
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "Voice Translation App",
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.1-8b-instruct:free",
        messages: [{ role: "user", content: "Reply with the single word: OK" }],
        max_tokens: 5,
      }),
    });

    const elapsed = Date.now() - t0;

    if (!orRes.ok) {
      const body = await orRes.text().catch(() => "");
      log("warn", "health_ai: OpenRouter rejected key", {
        status: orRes.status,
        elapsed,
      });
      return res.status(200).json({
        ok: false,
        status: orRes.status,
        error: body.slice(0, 200) || orRes.statusText,
        elapsed,
        timestamp: Date.now(),
      });
    }

    const data = await orRes.json();
    const reply = data?.choices?.[0]?.message?.content || "";
    log("info", "health_ai: key OK", { elapsed, reply });
    return res.json({ ok: true, elapsed, reply, timestamp: Date.now() });
  } catch (err) {
    const elapsed = Date.now() - t0;
    log("error", "health_ai: fetch failed", { error: err.message, elapsed });
    return res
      .status(500)
      .json({ ok: false, error: err.message, elapsed, timestamp: Date.now() });
  }
});

// ── free models: proxy OpenRouter model catalogue (avoids browser CORS) ───────
app.get("/api/free-models", async (_req, res) => {
  try {
    const orRes = await fetch(
      "https://openrouter.ai/api/frontend/models/find?active=true&fmt=cards&max_price=0&order=top-weekly",
      { headers: { Accept: "application/json" } },
    );
    if (!orRes.ok) {
      return res
        .status(orRes.status)
        .json({ error: "OpenRouter returned " + orRes.status });
    }
    const data = await orRes.json();
    // Response shape: { data: { models: [...] } }
    const rawList =
      data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
    const models = rawList
      .map((m) => ({
        id: m.slug || m.id || "",
        label: m.name || m.short_name || m.slug || "",
      }))
      .filter((m) => m.id);
    res.json({ models });
  } catch (err) {
    log("error", "free-models fetch failed", { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── chat proxy ────────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, model, apiKey, maxTokens } = req.body || {};

  if (!Array.isArray(messages) || !model) {
    return res
      .status(400)
      .json({ error: "messages (array) and model (string) are required" });
  }

  const key = apiKey || ENV_KEY;
  if (!key) {
    return res.status(401).json({
      error:
        "No API key available. Set OPENROUTER_API_KEY on the server, or enter one in the UI.",
    });
  }

  const keySource = apiKey ? "ui" : "server-env";
  log("info", "OpenRouter request", {
    model,
    messages: messages.length,
    keySource,
    maxTokens,
  });

  const orBody = { model, messages };
  if (maxTokens && Number.isInteger(maxTokens) && maxTokens > 0) {
    orBody.max_tokens = maxTokens;
  }

  const t0 = Date.now();
  try {
    const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          req.headers.referer || req.headers.origin || "http://localhost:5000",
        "X-Title": "Voice Translation App",
      },
      body: JSON.stringify(orBody),
    });

    const elapsed = Date.now() - t0;

    if (!orRes.ok) {
      const body = await orRes.text().catch(() => "");
      log("error", "OpenRouter error", {
        status: orRes.status,
        body: body.slice(0, 200),
        elapsed,
      });
      return res.status(orRes.status).json({
        error: `OpenRouter ${orRes.status}: ${body || orRes.statusText}`,
      });
    }

    const data = await orRes.json();
    const content = data?.choices?.[0]?.message?.content;
    const actualModel = data?.model || model;

    if (!content) {
      log("error", "Empty content in OpenRouter response", { data });
      return res
        .status(500)
        .json({ error: "No content in OpenRouter response" });
    }

    const keySuffix = key.length > 4 ? `...${key.slice(-4)}` : key ? "***" : "none";

    log("info", "OpenRouter OK", {
      model,
      actualModel,
      elapsed,
      keySuffix,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    });

    res.json({ content, model: actualModel, keySuffix });
  } catch (err) {
    const elapsed = Date.now() - t0;
    log("error", "OpenRouter fetch failed", { error: err.message, elapsed });
    res.status(500).json({ error: err.message });
  }
});

// ── SRT helpers ───────────────────────────────────────────────────────────────
const { fetchTranscript } = require("youtube-transcript-plus");

function padN(n, len) { return String(n).padStart(len, "0"); }
function msToSrtTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const x = Math.floor(ms % 1000);
  return `${padN(h,2)}:${padN(m,2)}:${padN(s,2)},${padN(x,3)}`;
}
function segmentsToSrt(segments) {
  return segments
    .map((seg, i) => {
      const start = msToSrtTime(Math.round(seg.offset * 1000));
      const end   = msToSrtTime(Math.round((seg.offset + seg.duration) * 1000));
      return `${i + 1}\n${start} --> ${end}\n${seg.text}`;
    })
    .join("\n\n");
}

// ── /api/srt — fetch YouTube transcript as SRT text ───────────────────────────
// Query params: videoId (required), lang (optional, default 'en')
app.get("/api/srt", async (req, res) => {
  const { videoId, lang } = req.query;
  if (!videoId) return res.status(400).json({ error: "videoId is required" });
  const langCode = String(lang || "en").split("-")[0];

  let method1Error = null;

  // Method 1: youtube-transcript-plus (CommonJS, faster)
  try {
    const segments = await fetchTranscript(String(videoId), { lang: langCode });
    const srt = segmentsToSrt(segments);
    log("info", "SRT method1 OK", { videoId, lang: langCode, segments: segments.length });
    return res.type("text/plain; charset=utf-8").send(srt);
  } catch (e1) {
    method1Error = e1.message;
    log("warn", "SRT method1 failed, trying method2", { videoId, lang: langCode, error: e1.message });
  }

  // Method 2: youtube-transcript-api-js (ESM, supports auto-translate)
  try {
    const { YouTubeTranscriptApi, SRTFormatter } = await import("youtube-transcript-api-js");
    const api  = new YouTubeTranscriptApi();
    const list = await api.list(String(videoId));
    let transcript;
    try {
      transcript = list.findTranscript([langCode]);
    } catch {
      // try auto-translate from English
      const base = list.findTranscript(["en", "ar", "he", "fr", "es", "de"]);
      transcript = base.isTranslatable ? base.translate(langCode) : base;
    }
    const fetched = await transcript.fetch();
    const srt = new SRTFormatter().formatTranscript(fetched);
    log("info", "SRT method2 OK", { videoId, lang: langCode });
    return res.type("text/plain; charset=utf-8").send(srt);
  } catch (e2) {
    log("error", "SRT both methods failed", { videoId, lang: langCode, e1: method1Error, e2: e2.message });
    return res.status(500).json({
      error: `Could not fetch transcript. Method1: ${method1Error}. Method2: ${e2.message}`,
    });
  }
});

// ── /api/tts — server-side Google TTS proxy (avoids browser CORS/UA blocks) ───
// Query params: text (required), lang (required, short code like 'ar', 'he', 'en')
app.get("/api/tts", async (req, res) => {
  const { text, lang } = req.query;
  if (!text || !lang) return res.status(400).json({ error: "text and lang are required" });
  const shortLang  = String(lang).split("-")[0];
  const encoded    = encodeURIComponent(String(text).slice(0, 200));
  const ttsUrl     = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${shortLang}&client=tw-ob&q=${encoded}`;

  try {
    const upstream = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!upstream.ok) {
      log("warn", "TTS upstream error", { status: upstream.status, lang: shortLang });
      return res.status(upstream.status).json({ error: `TTS upstream returned ${upstream.status}` });
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    log("info", "TTS OK", { lang: shortLang, bytes: buf.length, textLen: String(text).length });
    res.set("Content-Type", "audio/mpeg");
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buf);
  } catch (err) {
    log("error", "TTS fetch failed", { error: err.message, lang: shortLang });
    res.status(500).json({ error: err.message });
  }
});

// ── start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log("info", `Server listening on port ${PORT}`);
  log(
    "info",
    `API key source: ${ENV_KEY ? "OPENROUTER_API_KEY env var" : "none (UI must provide key)"}`,
  );
});
