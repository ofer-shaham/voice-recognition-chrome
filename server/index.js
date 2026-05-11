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
        model: "meta-llama/llama-3.1-8b-instruct",
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

    if (!content) {
      log("error", "Empty content in OpenRouter response", { data });
      return res
        .status(500)
        .json({ error: "No content in OpenRouter response" });
    }

    log("info", "OpenRouter OK", {
      model,
      elapsed,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    });

    res.json({ content });
  } catch (err) {
    const elapsed = Date.now() - t0;
    log("error", "OpenRouter fetch failed", { error: err.message, elapsed });
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
