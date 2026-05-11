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

const ENV_KEY =
  process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || "";

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

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  // Strip the function path prefix: /.netlify/functions/api/api/health -> /api/health
  const rawPath = event.path || "";
  // Netlify passes the full path; extract the part after /api
  const match = rawPath.match(/\/api(\/.*)?$/);
  const apiPath = match ? "/api" + (match[1] || "") : rawPath;

  // GET /api/health
  if (event.httpMethod === "GET" && apiPath === "/api/health") {
    const now = Date.now();
    return json(200, {
      ok: true,
      timestamp: now,
      startedAt: SERVER_START,
      age: formatAge(now - SERVER_START),
      uptime: Math.floor(process.uptime()),
    });
  }

  // GET /api/config
  if (event.httpMethod === "GET" && apiPath === "/api/config") {
    return json(200, { serverHasKey: !!ENV_KEY });
  }

  // GET /api/free-models
  if (event.httpMethod === "GET" && apiPath === "/api/free-models") {
    try {
      const orRes = await fetch(
        "https://openrouter.ai/api/frontend/models/find?active=true&fmt=cards&max_price=0&order=top-weekly",
        { headers: { Accept: "application/json" } }
      );
      if (!orRes.ok) {
        return json(orRes.status, { error: "OpenRouter returned " + orRes.status });
      }
      const data = await orRes.json();
      const rawList =
        data?.data?.models ?? data?.data ?? data?.models ?? data ?? [];
      const models = rawList
        .map((m) => ({
          id: m.slug || m.id || "",
          label: m.name || m.short_name || m.slug || "",
        }))
        .filter((m) => m.id);
      return json(200, { models });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  // POST /api/health_ai
  if (event.httpMethod === "POST" && apiPath === "/api/health_ai") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    const key = body.apiKey || ENV_KEY;

    if (!key) {
      return json(401, {
        ok: false,
        error: "No API key available. Set OPENROUTER_API_KEY or pass one in the request body.",
      });
    }

    const t0 = Date.now();
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://netlify.app",
          "X-Title": "Voice Translation App",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.1-8b-instruct",
          messages: [{ role: "user", content: "Reply with the single word: OK" }],
          max_tokens: 5,
        }),
      });
      const elapsed = Date.now() - t0;
      if (!orRes.ok) {
        const errBody = await orRes.text().catch(() => "");
        return json(200, { ok: false, status: orRes.status, error: errBody.slice(0, 200) || orRes.statusText, elapsed, timestamp: Date.now() });
      }
      const data = await orRes.json();
      const reply = data?.choices?.[0]?.message?.content || "";
      return json(200, { ok: true, elapsed, reply, timestamp: Date.now() });
    } catch (err) {
      return json(500, { ok: false, error: err.message, elapsed: Date.now() - t0, timestamp: Date.now() });
    }
  }

  // POST /api/chat
  if (event.httpMethod === "POST" && apiPath === "/api/chat") {
    let body = {};
    try { body = JSON.parse(event.body || "{}"); } catch {}
    const { messages, model, apiKey, maxTokens } = body;

    if (!Array.isArray(messages) || !model) {
      return json(400, { error: "messages (array) and model (string) are required" });
    }

    const key = apiKey || ENV_KEY;
    if (!key) {
      return json(401, {
        error: "No API key available. Set OPENROUTER_API_KEY on the server, or enter one in the UI.",
      });
    }

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
          "HTTP-Referer": "https://netlify.app",
          "X-Title": "Voice Translation App",
        },
        body: JSON.stringify(orBody),
      });

      if (!orRes.ok) {
        const errBody = await orRes.text().catch(() => "");
        return json(orRes.status, { error: `OpenRouter ${orRes.status}: ${errBody || orRes.statusText}` });
      }

      const data = await orRes.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content) return json(500, { error: "No content in OpenRouter response" });
      return json(200, { content });
    } catch (err) {
      return json(500, { error: err.message });
    }
  }

  return json(404, { error: "Not found" });
};
