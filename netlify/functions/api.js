const { ytPlayerData, fetchSrt } = require("../../server/services/youtube-transcript");
const { fetchTtsAudio } = require("../../server/services/tts-proxy");

const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";
const SERVER_START = Date.now();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const textResp = (statusCode, body) => ({
  statusCode,
  headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
  body,
});

const formatAge = (ms) => {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const SWAGGER_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    const specUrl = window.location.pathname.replace(/(\\/api-docs)$/, '$1.json');
    window.ui = SwaggerUIBundle({ url: specUrl, dom_id: '#swagger-ui', presets: [SwaggerUIBundle.presets.apis], layout: 'BaseLayout' });
  </script>
</body>
</html>`;

const SWAGGER_SPEC = {
  openapi: "3.0.0",
  info: { title: "YouTube Transcript & TTS API", version: "1.0.0", description: "Netlify Functions API" },
  servers: [{ url: "/", description: "Netlify Functions" }],
  paths: {
    "/api/transcript/languages": { get: { summary: "List caption languages", tags: ["Transcripts"], parameters: [{ name: "videoId", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "Language list" }, 400: { description: "Missing videoId" }, 500: { description: "Error" } } } },
    "/api/srt":    { get: { summary: "Fetch transcript as SRT", tags: ["Transcripts"], parameters: [{ name: "videoId", in: "query", required: true, schema: { type: "string" } }, { name: "lang", in: "query", schema: { type: "string", default: "en" } }, { name: "method", in: "query", schema: { type: "string", enum: ["1", "2"] } }], responses: { 200: { description: "SRT text" }, 400: { description: "Missing videoId" }, 500: { description: "Error" } } } },
    "/api/tts":    { get: { summary: "TTS audio proxy", tags: ["TTS"], parameters: [{ name: "text", in: "query", required: true, schema: { type: "string" } }, { name: "lang", in: "query", required: true, schema: { type: "string" } }], responses: { 200: { description: "MP3 audio" }, 400: { description: "Missing params" }, 500: { description: "Error" } } } },
    "/api/chat":   { post: { summary: "OpenRouter chat proxy", tags: ["AI"], responses: { 200: { description: "Chat response" }, 401: { description: "No key" }, 500: { description: "Error" } } } },
    "/api/health": { get: { summary: "Health check", tags: ["Health"], responses: { 200: { description: "OK" } } } },
  },
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Extract the original request path before Netlify's rewrite.
  // event.rawUrl holds the full original URL (e.g. https://site.netlify.app/api/srt?v=xxx).
  // Parsing its pathname gives us "/api/srt" reliably, regardless of how the
  // redirect rule is written or whether classic Functions strip sub-paths.
  const apiPath = (() => {
    if (event.rawUrl) {
      try {
        const p = new URL(event.rawUrl).pathname;
        // Grab from the first /api or /api-docs occurrence onward
        const idx = p.search(/\/api(-docs)?([/?]|$)/);
        if (idx !== -1) return p.slice(idx).replace(/\/$/, "") || "/api";
      } catch { /* fall through */ }
    }
    // Fallback: strip any /.netlify/functions/<name> prefix from event.path
    const p = (event.path || "").replace(/^\/.netlify\/functions\/[^/]+/, "");
    return p || "/api";
  })();
  const qs = event.queryStringParameters || {};

  // ── Swagger ──────────────────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && /\/api-docs\.json$/.test(apiPath)) {
    return json(200, SWAGGER_SPEC);
  }
  if (event.httpMethod === "GET" && /\/api-docs$/.test(apiPath)) {
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }, body: SWAGGER_HTML };
  }

  // ── Health ───────────────────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && apiPath === "/api/health") {
    const now = Date.now();
    return json(200, { ok: true, timestamp: now, startedAt: SERVER_START, age: formatAge(now - SERVER_START), uptime: Math.floor(process.uptime()) });
  }

  if (event.httpMethod === "GET" && apiPath === "/api/config") {
    return json(200, { serverHasKey: !!ENV_KEY });
  }

  // ── Transcript languages ──────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && apiPath === "/api/transcript/languages") {
    const { videoId } = qs;
    if (!videoId) return json(400, { error: "videoId is required" });
    try {
      const data   = await ytPlayerData(String(videoId));
      let tracks   = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
      if (!tracks.length) {
        try {
          const { YouTubeTranscriptApi } = await import("youtube-transcript-api-js");
          const api  = new YouTubeTranscriptApi();
          const list = await api.list(String(videoId));
          tracks = (list?.transcripts || []).map(t => ({
            languageCode: t.languageCode || "",
            name: { simpleText: t.language || t.languageCode || "" },
            kind: t.isGenerated ? "asr" : undefined,
          }));
        } catch { /* ignore fallback failure */ }
      }
      const vd = data?.videoDetails || {};
      return json(200, {
        videoDetails: { title: vd.title || null, author: vd.author || null, lengthSeconds: vd.lengthSeconds || null, videoId: vd.videoId || videoId },
        availableLanguages: tracks.map(t => ({ languageCode: t.languageCode, name: t.name?.simpleText || t.languageCode, isAutoGenerated: t.kind === "asr" })),
      });
    } catch (e) {
      return json(500, { error: e.message });
    }
  }

  // ── SRT fetch ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && apiPath === "/api/srt") {
    const { videoId, lang, method } = qs;
    if (!videoId) return json(400, { error: "videoId is required" });
    const langCode = String(lang || "en").split("-")[0];
    try {
      return textResp(200, await fetchSrt(String(videoId), langCode, method));
    } catch (e) {
      return json(500, { error: e.message });
    }
  }

  // ── TTS proxy ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && apiPath === "/api/tts") {
    const { text: ttsText, lang } = qs;
    if (!ttsText || !lang) return json(400, { error: "text and lang are required" });
    try {
      const buf = await fetchTtsAudio(ttsText, lang);
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600" },
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      return json(err.status || 500, { error: err.message });
    }
  }

  // ── Free models ───────────────────────────────────────────────────────────────
  if (event.httpMethod === "GET" && apiPath === "/api/free-models") {
    try {
      const orRes = await fetch(
        "https://openrouter.ai/api/frontend/models/find?active=true&fmt=cards&max_price=0&order=top-weekly",
        { headers: { Accept: "application/json" } }
      );
      if (!orRes.ok) return json(orRes.status, { error: "OpenRouter returned " + orRes.status });
      const data    = await orRes.json();
      const rawList = data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
      const models  = rawList.map((m) => ({ id: m.slug || m.id || "", label: m.name || m.short_name || m.slug || "" })).filter((m) => m.id);
      return json(200, { models });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  // ── AI health ─────────────────────────────────────────────────────────────────
  if (event.httpMethod === "POST" && apiPath === "/api/health_ai") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    const key = body.apiKey || ENV_KEY;
    if (!key) return json(401, { ok: false, error: "No API key available." });
    const t0 = Date.now();
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://netlify.app", "X-Title": "Voice Translation App" },
        body: JSON.stringify({ model: "meta-llama/llama-3.1-8b-instruct:free", messages: [{ role: "user", content: "Reply with the single word: OK" }], max_tokens: 5 }),
      });
      const elapsed = Date.now() - t0;
      if (!orRes.ok) {
        const errBody = await orRes.text().catch(() => "");
        return json(200, { ok: false, status: orRes.status, error: errBody.slice(0, 200), elapsed, timestamp: Date.now() });
      }
      const data = await orRes.json();
      return json(200, { ok: true, elapsed, reply: data?.choices?.[0]?.message?.content || "", timestamp: Date.now() });
    } catch (err) {
      return json(500, { ok: false, error: err.message, elapsed: Date.now() - t0, timestamp: Date.now() });
    }
  }

  // ── Chat proxy ────────────────────────────────────────────────────────────────
  if (event.httpMethod === "POST" && apiPath === "/api/chat") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    const { messages, model, apiKey, maxTokens } = body;
    if (!Array.isArray(messages) || !model) return json(400, { error: "messages (array) and model (string) are required" });
    const key = apiKey || ENV_KEY;
    if (!key) return json(401, { error: "No API key available. Set OPENROUTER_API_KEY, or enter one in the UI." });
    const orBody = { model, messages };
    if (maxTokens && Number.isInteger(maxTokens) && maxTokens > 0) orBody.max_tokens = maxTokens;
    const t0 = Date.now();
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://netlify.app", "X-Title": "Voice Translation App" },
        body: JSON.stringify(orBody),
      });
      if (!orRes.ok) {
        const errBody = await orRes.text().catch(() => "");
        return json(orRes.status, { error: `OpenRouter ${orRes.status}: ${errBody || orRes.statusText}` });
      }
      const data    = await orRes.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return json(500, { error: "No content in OpenRouter response" });
      return json(200, { content, model: data?.model || model });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  return json(404, { error: "Not found" });
};
