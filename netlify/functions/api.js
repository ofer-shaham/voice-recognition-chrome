const { ytPlayerData, fetchSrt } = require("../../server/services/youtube-transcript");
const { fetchTtsAudio } = require("../../server/services/tts-proxy");

const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";
const SERVER_START = Date.now();

// ── In-memory log buffer (persists across warm Lambda invocations) ─────────────
const LOG_BUFFER_MAX = 200;
const logBuffer = [];
let logSeq = 0;

const log = (level, msg, meta = {}) => {
  const ts = new Date().toISOString();
  const rest = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}${rest}`);
  logBuffer.unshift({ id: ++logSeq, ts, level: level.toUpperCase(), msg, meta });
  if (logBuffer.length > LOG_BUFFER_MAX) logBuffer.length = LOG_BUFFER_MAX;
};

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

const SWAGGER_DARK_CSS = `
  body{background:#0d1117!important}
  .swagger-ui{color:#c9d1d9;background:#0d1117}
  .swagger-ui .topbar{background:#161b29;border-bottom:1px solid #21262d;padding:8px 0}
  .swagger-ui .topbar a{color:#58a6ff}
  .swagger-ui .info .title,.swagger-ui .info h1,.swagger-ui .info h2,.swagger-ui .info h3{color:#e6edf3}
  .swagger-ui .info p,.swagger-ui .info li{color:#8b949e}
  .swagger-ui .info a{color:#58a6ff}
  .swagger-ui .scheme-container{background:#0d1117;box-shadow:none;border-bottom:1px solid #21262d}
  .swagger-ui select{background:#161b29;color:#c9d1d9;border-color:#30363d}
  .swagger-ui input[type=text],.swagger-ui textarea{background:#0d1117;color:#c9d1d9;border-color:#30363d}
  .swagger-ui input[type=text]:focus,.swagger-ui textarea:focus{border-color:#58a6ff;outline:none}
  .swagger-ui .opblock{border-color:#21262d!important;background:#161b29;border-radius:6px;margin-bottom:8px}
  .swagger-ui .opblock .opblock-summary{border-color:#21262d}
  .swagger-ui .opblock .opblock-summary-operation-id,.swagger-ui .opblock .opblock-summary-path,.swagger-ui .opblock .opblock-summary-path__deprecated,.swagger-ui .opblock .opblock-summary-description{color:#c9d1d9}
  .swagger-ui .opblock .opblock-section-header{background:#1c2128;border-color:#30363d}
  .swagger-ui .opblock .opblock-section-header h4{color:#e6edf3}
  .swagger-ui .opblock.opblock-get{border-color:#1f6feb!important;background:#0d1e36}
  .swagger-ui .opblock.opblock-get .opblock-summary{border-color:#1f6feb;background:#0d1e36}
  .swagger-ui .opblock.opblock-post{border-color:#238636!important;background:#0d2818}
  .swagger-ui .opblock.opblock-post .opblock-summary{border-color:#238636;background:#0d2818}
  .swagger-ui .opblock.opblock-put{border-color:#9e6a03!important;background:#271d04}
  .swagger-ui .opblock.opblock-delete{border-color:#b91c1c!important;background:#2d1010}
  .swagger-ui .opblock-tag{color:#e6edf3;border-color:#21262d}
  .swagger-ui .opblock-tag:hover{background:#161b29}
  .swagger-ui .opblock-tag small{color:#8b949e}
  .swagger-ui .tab li{color:#8b949e}
  .swagger-ui .tab li.active{color:#e6edf3}
  .swagger-ui table thead tr td,.swagger-ui table thead tr th{color:#8b949e;border-color:#21262d}
  .swagger-ui .parameter__name{color:#c9d1d9}
  .swagger-ui .parameter__type{color:#79c0ff}
  .swagger-ui .parameter__deprecated{color:#f85149}
  .swagger-ui .parameter__in{color:#56d364}
  .swagger-ui table.model tr td{color:#c9d1d9;border-color:#21262d}
  .swagger-ui .response-col_status{color:#c9d1d9}
  .swagger-ui .response-col_description{color:#8b949e}
  .swagger-ui .responses-inner h4,.swagger-ui .responses-inner h5{color:#e6edf3}
  .swagger-ui .response .response-col_description__inner{color:#8b949e}
  .swagger-ui section.models{border-color:#21262d;background:#0d1117}
  .swagger-ui section.models h4{color:#e6edf3}
  .swagger-ui section.models .model-container{background:#161b29;border-color:#30363d}
  .swagger-ui .model{color:#c9d1d9}
  .swagger-ui .model-title{color:#e6edf3}
  .swagger-ui .model .property.primitive{color:#79c0ff}
  .swagger-ui .btn{border-color:#30363d;color:#c9d1d9;background:#21262d}
  .swagger-ui .btn:hover{background:#30363d}
  .swagger-ui .btn.execute{background:#1f6feb;border-color:#1f6feb;color:#fff}
  .swagger-ui .btn.execute:hover{background:#388bfd}
  .swagger-ui .btn.cancel{background:#b91c1c;border-color:#b91c1c;color:#fff}
  .swagger-ui .btn.authorize{background:#238636;border-color:#238636;color:#fff}
  .swagger-ui .loading-container .loading::after{border-color:#58a6ff transparent #58a6ff transparent}
  .swagger-ui .markdown p,.swagger-ui .markdown li{color:#8b949e}
  .swagger-ui .markdown code,.swagger-ui .renderedMarkdown code{background:#161b29;color:#79c0ff;padding:2px 6px;border-radius:4px}
  .swagger-ui .highlight-code{background:#161b29}
  .swagger-ui .microlight{background:#161b29!important;color:#c9d1d9}
  .swagger-ui .copy-to-clipboard{background:#21262d}
  .swagger-ui .copy-to-clipboard button{background:#21262d}
  .swagger-ui .arrow{fill:#8b949e}
  .swagger-ui svg.arrow{fill:#8b949e}
  .swagger-ui .expand-methods svg,.swagger-ui .expand-operation svg{fill:#8b949e}
  .swagger-ui .servers>label{color:#8b949e}
  .swagger-ui .servers>label select{background:#161b29;color:#c9d1d9;border-color:#30363d}
  .swagger-ui .auth-wrapper .authorize{border-color:#238636}
  .swagger-ui .dialog-ux .modal-ux{background:#161b29;border-color:#30363d}
  .swagger-ui .dialog-ux .modal-ux-header{background:#1c2128;border-color:#30363d}
  .swagger-ui .dialog-ux .modal-ux-header h3{color:#e6edf3}
  .swagger-ui .dialog-ux .modal-ux-content{color:#c9d1d9}
`;

const SWAGGER_HTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>${SWAGGER_DARK_CSS}</style>
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
  info: { title: "YouTube Transcript & TTS API", version: "1.0.0", description: "Netlify Functions API — logs endpoint returns in-memory entries accumulated since the current Lambda container started (warm invocations only; cold starts reset the buffer)." },
  servers: [{ url: "/", description: "Netlify Functions" }],
  tags: [
    { name: "Transcripts", description: "YouTube caption / SRT endpoints" },
    { name: "TTS",         description: "Text-to-speech proxy" },
    { name: "AI",          description: "OpenRouter chat proxy" },
    { name: "Health",      description: "Server status & logs" },
  ],
  paths: {
    "/api/transcript/languages": {
      get: {
        summary: "List caption languages", tags: ["Transcripts"],
        parameters: [{ name: "videoId", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Language list" }, 400: { description: "Missing videoId" }, 500: { description: "Error" } },
      },
    },
    "/api/srt": {
      get: {
        summary: "Fetch transcript as SRT", tags: ["Transcripts"],
        parameters: [
          { name: "videoId", in: "query", required: true,  schema: { type: "string" } },
          { name: "lang",    in: "query", required: false, schema: { type: "string", default: "en" } },
          { name: "method",  in: "query", required: false, schema: { type: "string", enum: ["1", "2", "3"] }, description: "1=youtube-transcript-plus (deprecated, requires Node>=20), 2=youtube-transcript-api-js, 3=ytInitialPlayerResponse+json3 (downsub-style)" },
        ],
        responses: { 200: { description: "SRT text" }, 400: { description: "Missing videoId" }, 500: { description: "Error" } },
      },
    },
    "/api/tts": {
      get: {
        summary: "TTS audio proxy", tags: ["TTS"],
        parameters: [
          { name: "text", in: "query", required: true,  schema: { type: "string" } },
          { name: "lang", in: "query", required: true,  schema: { type: "string" } },
        ],
        responses: { 200: { description: "MP3 audio" }, 400: { description: "Missing params" }, 500: { description: "Error" } },
      },
    },
    "/api/chat": {
      post: {
        summary: "OpenRouter chat proxy", tags: ["AI"],
        responses: { 200: { description: "Chat response" }, 401: { description: "No key" }, 500: { description: "Error" } },
      },
    },
    "/api/health": {
      get: {
        summary: "Health check", tags: ["Health"],
        responses: { 200: { description: "OK" } },
      },
    },
    "/api/logs": {
      get: {
        summary: "In-function request logs (ring buffer, last 200 entries)", tags: ["Health"],
        description: "Returns log entries accumulated in this Lambda container's memory. Note: Netlify platform logs (build/deploy) require a Netlify auth token and are not exposed here. This endpoint returns request-level logs written by the function handler itself.",
        parameters: [
          { name: "since", in: "query", required: false, schema: { type: "integer" }, description: "Return only entries with id > since (for incremental polling)" },
        ],
        responses: {
          200: {
            description: "Log entries",
            content: { "application/json": { schema: { type: "object", properties: {
              entries: { type: "array", items: { type: "object", properties: {
                id:    { type: "integer" },
                ts:    { type: "string", format: "date-time" },
                level: { type: "string", enum: ["INFO", "WARN", "ERROR"] },
                msg:   { type: "string" },
                meta:  { type: "object" },
              }}},
              maxId: { type: "integer" },
              note:  { type: "string" },
            }}},
          },
        },
      },
    },
  },
},
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const apiPath = (() => {
    if (event.rawUrl) {
      try {
        const p = new URL(event.rawUrl).pathname;
        const idx = p.search(/\/api(-docs)?([/?]|$)/);
        if (idx !== -1) return p.slice(idx).replace(/\/$/, "") || "/api";
      } catch { /* fall through */ }
    }
    const p = (event.path || "").replace(/^\/.netlify\/functions\/[^/]+/, "");
    return p || "/api";
  })();
  const qs = event.queryStringParameters || {};
  const method = event.httpMethod;

  log("info", `${method} ${apiPath}`, Object.keys(qs).length ? qs : {});

  // ── Swagger ──────────────────────────────────────────────────────────────────
  if (method === "GET" && /\/api-docs\.json$/.test(apiPath)) {
    return json(200, SWAGGER_SPEC);
  }
  if (method === "GET" && /\/api-docs$/.test(apiPath)) {
    return { statusCode: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }, body: SWAGGER_HTML };
  }

  // ── Health ───────────────────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/health") {
    const now = Date.now();
    return json(200, { ok: true, timestamp: now, startedAt: SERVER_START, age: formatAge(now - SERVER_START), uptime: Math.floor(process.uptime()) });
  }

  if (method === "GET" && apiPath === "/api/config") {
    return json(200, { serverHasKey: !!ENV_KEY });
  }

  // ── Logs ─────────────────────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/logs") {
    const since = parseInt(qs.since || "0", 10);
    const entries = since ? logBuffer.filter(e => e.id > since) : logBuffer;
    return json(200, {
      entries,
      maxId: logBuffer[0]?.id || 0,
      note: "Netlify functions are stateless — this buffer resets on cold starts. For persistent logs use Netlify's dashboard or CLI: `netlify logs:function`.",
    });
  }

  // ── Transcript languages ──────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/transcript/languages") {
    const { videoId } = qs;
    if (!videoId) return json(400, { error: "videoId is required" });
    const t0 = Date.now();
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
        } catch (fb) { log("warn", "transcript/languages fallback failed", { videoId, error: fb.message }); }
      }
      const vd = data?.videoDetails || {};
      const result = {
        videoDetails: { title: vd.title || null, author: vd.author || null, lengthSeconds: vd.lengthSeconds || null, videoId: vd.videoId || videoId },
        availableLanguages: tracks.map(t => ({ languageCode: t.languageCode, name: t.name?.simpleText || t.languageCode, isAutoGenerated: t.kind === "asr" })),
      };
      log("info", "transcript/languages OK", { videoId, tracks: result.availableLanguages.length, elapsed: Date.now() - t0 });
      return json(200, result);
    } catch (e) {
      log("error", "transcript/languages failed", { videoId, error: e.message, elapsed: Date.now() - t0 });
      return json(500, { error: e.message });
    }
  }

  // ── SRT fetch ─────────────────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/srt") {
    const { videoId, lang, method: srtMethod } = qs;
    if (!videoId) return json(400, { error: "videoId is required" });
    const langCode = String(lang || "en").split("-")[0];
    const t0 = Date.now();
    try {
      const srt = await fetchSrt(String(videoId), langCode, srtMethod);
      log("info", "SRT OK", { videoId, lang: langCode, method: srtMethod || "auto", elapsed: Date.now() - t0 });
      return textResp(200, srt);
    } catch (e) {
      log("error", "SRT failed", { videoId, lang: langCode, error: e.message, elapsed: Date.now() - t0 });
      return json(500, { error: e.message });
    }
  }

  // ── TTS proxy ─────────────────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/tts") {
    const { text: ttsText, lang } = qs;
    if (!ttsText || !lang) return json(400, { error: "text and lang are required" });
    const t0 = Date.now();
    try {
      const buf = await fetchTtsAudio(ttsText, lang);
      log("info", "TTS OK", { lang: String(lang).split("-")[0], bytes: buf.length, elapsed: Date.now() - t0 });
      return {
        statusCode: 200,
        headers: { ...corsHeaders, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=3600" },
        body: buf.toString("base64"),
        isBase64Encoded: true,
      };
    } catch (err) {
      log("warn", "TTS failed", { error: err.message, elapsed: Date.now() - t0 });
      return json(err.status || 500, { error: err.message });
    }
  }

  // ── Free models ───────────────────────────────────────────────────────────────
  if (method === "GET" && apiPath === "/api/free-models") {
    const t0 = Date.now();
    try {
      const orRes = await fetch(
        "https://openrouter.ai/api/frontend/models/find?active=true&fmt=cards&max_price=0&order=top-weekly",
        { headers: { Accept: "application/json" } }
      );
      if (!orRes.ok) {
        log("warn", "free-models upstream error", { status: orRes.status });
        return json(orRes.status, { error: "OpenRouter returned " + orRes.status });
      }
      const data    = await orRes.json();
      const rawList = data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
      const models  = rawList.map((m) => ({ id: m.slug || m.id || "", label: m.name || m.short_name || m.slug || "" })).filter((m) => m.id);
      log("info", "free-models OK", { count: models.length, elapsed: Date.now() - t0 });
      return json(200, { models });
    } catch (err) {
      log("error", "free-models fetch failed", { error: err.message });
      return json(500, { error: err.message });
    }
  }

  // ── AI health ─────────────────────────────────────────────────────────────────
  if (method === "POST" && apiPath === "/api/health_ai") {
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
        log("warn", "health_ai check failed", { status: orRes.status, elapsed });
        return json(200, { ok: false, status: orRes.status, error: errBody.slice(0, 200), elapsed, timestamp: Date.now() });
      }
      const data = await orRes.json();
      log("info", "health_ai OK", { elapsed });
      return json(200, { ok: true, elapsed, reply: data?.choices?.[0]?.message?.content || "", timestamp: Date.now() });
    } catch (err) {
      log("error", "health_ai exception", { error: err.message });
      return json(500, { ok: false, error: err.message, elapsed: Date.now() - t0, timestamp: Date.now() });
    }
  }

  // ── Chat proxy ────────────────────────────────────────────────────────────────
  if (method === "POST" && apiPath === "/api/chat") {
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
        log("error", "OpenRouter chat error", { status: orRes.status, model, elapsed: Date.now() - t0 });
        return json(orRes.status, { error: `OpenRouter ${orRes.status}: ${errBody || orRes.statusText}` });
      }
      const data    = await orRes.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return json(500, { error: "No content in OpenRouter response" });
      log("info", "OpenRouter chat OK", { model, elapsed: Date.now() - t0, promptTokens: data.usage?.prompt_tokens, completionTokens: data.usage?.completion_tokens });
      return json(200, { content, model: data?.model || model });
    } catch (err) {
      log("error", "OpenRouter chat exception", { error: err.message, elapsed: Date.now() - t0 });
      return json(500, { error: err.message });
    }
  }

  log("warn", "404 not found", { path: apiPath, method });
  return json(404, { error: "Not found" });
};
