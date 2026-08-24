# Voice Translation App — Project Summary

## What it is
A language-learning app with voice conversation, YouTube transcript navigation, AI chat (OpenRouter), proverbs browser, and simultaneous translation. React frontend + Express backend.

## Stack
- **Frontend**: React 18 + TypeScript, `react-scripts` (CRA), port 5000
- **Backend**: Node.js Express server, port 3001
- **AI**: OpenRouter (free models: Llama, Gemma, Mistral, DeepSeek, Qwen, etc.)
- **TTS**: Google Translate TTS proxy (server-side to avoid CORS)
- **Transcripts**: `youtube-transcript-api-js` (method 2), ytInitialPlayerResponse (method 3), DownSub API (method 4, default). Method 1 (`youtube-transcript-plus`) is **deprecated** (requires Node >=20).
- **Deployment**: Netlify (static build + Netlify Functions for API)
- **Monorepo**: frontend at root, server at `server/`, netlify function at `netlify/functions/`

## Running (Replit)
Two parallel workflows:
1. `Start application` — `PORT=5000 DANGEROUSLY_DISABLE_HOST_CHECK=true npm start` (React dev server)
2. `Start server` — `bash server/start.sh` → `node server/index.js`

Frontend proxies `/api/*` to `http://localhost:3001` (set in `package.json` `"proxy"` field).

## Key files
```
src/
  App.tsx                         — React Router: /, /youtube, /proverb, /simultanuos_translation, /ai-conversation
  components/AiConversation/      — Voice AI chat (OpenRouter, STT, TTS loop)
  components/YoutubeLearner/      — YouTube video + transcript navigator
  components/Proverbs/            — Proverbs browser (multi-language)
  services/openRouterService.ts   — Frontend API client (calls /api/chat, /api/config, etc.)

server/
  index.js                        — Express server (imports shared services)
  services/
    youtube-transcript.js         — SHARED: ytPlayerData, fetchSrt, fetchSrtMethod1/2/3/4 (CJS)
    tts-proxy.js                  — SHARED: fetchTtsAudio (CJS)
    transcript-plus-standalone.js — Reference: standalone Express using youtube-transcript-api-js
    transcript-api-standalone.js  — [DEPRECATED] Reference: youtube-transcript-plus (requires Node>=20)
    transcript-plus-quickstart.js — [DEPRECATED] Reference: youtube-transcript-plus quickstart
    tts-download-to-file.js       — Utility: CLI download TTS audio to disk

netlify/
  functions/api.js                — Netlify Function handler (imports same shared services)
  functions/package.json          — Lists youtube-transcript-api-js; youtube-transcript-plus is optional
```

## API endpoints (both Express & Netlify)
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/health | Liveness check |
| GET | /api/config | Returns `{serverHasKey: bool}` |
| GET | /api/transcript/languages?videoId= | YouTube caption language list |
| GET | /api/srt?videoId=&lang=&method= | Fetch transcript as SRT (method 1/2/auto) |
| GET | /api/tts?text=&lang= | Google TTS MP3 proxy |
| GET | /api/free-models | OpenRouter free model list |
| POST | /api/chat | OpenRouter chat completions |
| POST | /api/health_ai | Test OpenRouter key |
| GET | /api-docs | Swagger UI |
| GET | /api-docs.json | OpenAPI spec |

## Environment variables
- `OPENROUTER_API_KEY` — optional server-side key; UI can accept user-provided key instead
- `PORT` — server port (default 3001), frontend port (default 3000, overridden to 5000)

## Netlify deploy
- Build: `npm run build` → `build/` directory
- Functions: `netlify/functions/` with NFT bundler (supports ESM dynamic import)
- Redirect: `/api/*` → `/.netlify/functions/api/api/:splat`
- SPA fallback: `/*` → `/index.html`

## No-duplication architecture
Shared transcript + TTS logic lives in `server/services/youtube-transcript.js` and `server/services/tts-proxy.js`. Both `server/index.js` (Express) and `netlify/functions/api.js` (Netlify Function) import from these — single source of truth.

## Install
```bash
npm install          # frontend
cd server && npm install   # backend
```
