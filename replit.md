# my-app — Speech Translation App

## Run & Operate
| Command | Purpose |
|---|---|
| `npm start` | React client (port 5000) |
| `node server/index.js` | OpenRouter proxy server (port 3001) |
| `npm run build` | Production build → `build/` |
| `./manage.sh start` | Docker Compose: build + start both services |
| `./manage.sh logs [client\|server\|openrouter]` | Follow logs |
| `./manage.sh --native start` | Start server + client without Docker |

### One-time setup — serve on port 80 (public URL)

Replit's proxy automatically maps internal port 5000 → external port 80 (public HTTPS URL).
Run this once after cloning to build Docker images and start both services:

```bash
cp .env.example .env          # add your OPENROUTER_API_KEY to .env
./manage.sh start             # builds images + starts client (5000) and server (3001)
```

After that the app is live at `https://$REPLIT_DEV_DOMAIN` (port 80/443 publicly).
Subsequent restarts: `./manage.sh restart` (no rebuild needed unless code changed).

**Required env vars (Replit Secrets):**
- `REACT_APP_OPENAI_API_KEY` — OpenRouter key (used by the server as `OPENROUTER_API_KEY`)

**Docker Compose env vars (`.env` file, see `.env.example`):**
- `OPENROUTER_API_KEY` — OpenRouter key for server container

## Stack
- **Frontend:** React 18 + TypeScript, Create React App (react-scripts 5), port 5000
- **Backend:** Node.js + Express (server/), port 3001
- **Routing:** react-router-dom v6
- **Speech:** react-speech-recognition, tts-react
- **AI:** OpenRouter API (server-side proxy)
- **Infra:** Docker Compose (`docker-compose.yml`), `manage.sh` lifecycle script

## Where things live
```
src/
  App.tsx                        # Root router
  components/AiConversation/     # AI chat UI
  services/openRouterService.ts  # Client → server API calls
  hooks/                         # Custom hooks
  styles/                        # CSS files
  utils/                         # TTS, translation helpers
server/
  index.js                       # Express server: proxies OpenRouter, logs all calls
  package.json                   # Server deps (express, cors)
  Dockerfile                     # Server Docker image
Dockerfile                       # Client Docker image (accepts REACT_APP_API_URL build arg)
docker-compose.yml               # Orchestrates client (5000) + server (3001)
manage.sh                        # Lifecycle script (start/stop/restart/status/build/logs)
.env.example                     # Template for Docker env vars
```

## Architecture decisions
- **Server-side OpenRouter proxy:** API key lives on the server (`OPENROUTER_API_KEY`), never exposed to the browser. Client may send an optional UI-provided key override.
- **CRA proxy in dev:** `"proxy": "http://localhost:3001"` in `package.json` forwards `/api/*` requests to the server without CORS issues.
- **Docker build arg:** `REACT_APP_API_URL` is baked into the client image at build time (CRA requirement). Defaults to `http://localhost:3001`.
- **Two Replit workflows:** "Start application" (client, webview) + "Start server" (server, console). Both auto-start with Replit secrets injected.
- **manage.sh:** Docker Compose is the default mode. `--native` flag runs both services without Docker using PID files + `logs/` directory.

## Product
- **Speech Recognition & Translation** (`/`) — Listen and translate using Web Speech API
- **YouTube Transcript Parser** (`/youtube`) — Parse transcripts with timestamp sync
- **Proverbs** (`/proverb`) — Proverb display
- **Simultaneous Translation** (`/simultanuos_translation`) — Real-time translation
- **AI Conversation** (`/ai-conversation`) — Chat via OpenRouter (voice + text, server-proxied)

## User preferences
- Keep API key server-side; UI can override with a paste-in key saved to localStorage
- Model name should be a free-text combobox (any OpenRouter model ID), not a fixed dropdown

## Gotchas
- `DANGEROUSLY_DISABLE_HOST_CHECK=true` required for Replit's proxied iframe preview
- Server reads `REACT_APP_OPENAI_API_KEY` as a fallback for `OPENROUTER_API_KEY` (both env vars work)
- `checkServerKey()` retries up to 4× with 1.5s delay — server may start slightly after client

## Pointers
- OpenRouter models: https://openrouter.ai/models
- CRA proxy docs: https://create-react-app.dev/docs/proxying-api-requests-in-development/
