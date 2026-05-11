const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3001;
const ENV_KEY = process.env.OPENROUTER_API_KEY || process.env.REACT_APP_OPENAI_API_KEY || '';

// ── middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ── structured logger ─────────────────────────────────────────────────────────
const log = (level, msg, meta = {}) => {
  const ts   = new Date().toISOString();
  const rest = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
  console.log(`[${ts}] [${level.toUpperCase()}] ${msg}${rest}`);
};

// ── request logger middleware ─────────────────────────────────────────────────
app.use((req, _res, next) => {
  log('info', `${req.method} ${req.path}`);
  next();
});

// ── health ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ── config (lets client know if server has a key) ────────────────────────────
app.get('/api/config', (_req, res) => {
  res.json({ serverHasKey: !!ENV_KEY });
});

// ── chat proxy ────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, model, apiKey, maxTokens } = req.body || {};

  if (!Array.isArray(messages) || !model) {
    return res.status(400).json({ error: 'messages (array) and model (string) are required' });
  }

  const key = apiKey || ENV_KEY;
  if (!key) {
    return res.status(401).json({
      error: 'No API key available. Set OPENROUTER_API_KEY on the server, or enter one in the UI.',
    });
  }

  const keySource = apiKey ? 'ui' : 'server-env';
  log('info', 'OpenRouter request', { model, messages: messages.length, keySource, maxTokens });

  const orBody = { model, messages };
  if (maxTokens && Number.isInteger(maxTokens) && maxTokens > 0) {
    orBody.max_tokens = maxTokens;
  }

  const t0 = Date.now();
  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
        'X-Title': 'Voice Translation App',
      },
      body: JSON.stringify(orBody),
    });

    const elapsed = Date.now() - t0;

    if (!orRes.ok) {
      const body = await orRes.text().catch(() => '');
      log('error', 'OpenRouter error', { status: orRes.status, body: body.slice(0, 200), elapsed });
      return res.status(orRes.status).json({
        error: `OpenRouter ${orRes.status}: ${body || orRes.statusText}`,
      });
    }

    const data    = await orRes.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      log('error', 'Empty content in OpenRouter response', { data });
      return res.status(500).json({ error: 'No content in OpenRouter response' });
    }

    log('info', 'OpenRouter OK', {
      model,
      elapsed,
      promptTokens:     data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    });

    res.json({ content });
  } catch (err) {
    const elapsed = Date.now() - t0;
    log('error', 'OpenRouter fetch failed', { error: err.message, elapsed });
    res.status(500).json({ error: err.message });
  }
});

// ── start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  log('info', `Server listening on port ${PORT}`);
  log('info', `API key source: ${ENV_KEY ? 'OPENROUTER_API_KEY env var' : 'none (UI must provide key)'}`);
});
