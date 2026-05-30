# YouTube Transcript Server

Express proxy for YouTube transcript fetching, TTS, and OpenRouter AI chat.

---

## Starting the server

```bash
# From the project root
node server/index.js

# Or from the server/ directory
cd server && npm start
```

The server listens on **port 3001** by default.

---

## Swagger UI

Once the server is running, open the interactive API docs in your browser:

| Environment | URL |
|---|---|
| Local | http://localhost:3001/api-docs |
| Replit preview | `<your-replit-preview-url>/api-docs` |

Click **Try it out** on any endpoint, then **Execute** to send a live request. The `videoId` fields are pre-filled with a working example (`https://www.youtube.com/watch?v=dQw4w9WgXcQ`) so you can test immediately without typing anything.

The raw OpenAPI JSON spec is also available at `/api-docs.json`.

---

## Running the CLI transcript test

The test hits `/api/srt` with both fetch methods against a real video and reports pass/fail.

**The server must be running before you execute the test.**

```bash
node server/test-transcript.js
```

Output goes to stdout. A detailed log (UTC timestamp, pass/fail, elapsed time, first 300 chars of SRT body) is **appended** to `server/test-results.log` on every run so you can track history.

Exit code is `0` if both methods pass, `1` if either fails.

---

## `/api/srt` fetch methods

The endpoint supports an optional `?method=` query parameter to force a specific fetch strategy.

| `method` value | Library used | Best for |
|---|---|---|
| `1` | `youtube-transcript-plus` | Fast direct-fetch with server-side translation via `&tlang=`; preferred for most videos |
| `2` | `youtube-transcript-api-js` | Fallback; uses YouTube's caption list API; useful when method 1 is blocked |
| *(omitted)* | Auto-fallback | Tries method 1 first; automatically falls back to method 2 on any error |

### Example `curl` commands

**Method 1 only:**
```bash
curl "http://localhost:3001/api/srt?videoId=dQw4w9WgXcQ&lang=en&method=1"
```

**Method 2 only:**
```bash
curl "http://localhost:3001/api/srt?videoId=dQw4w9WgXcQ&lang=en&method=2"
```

**Auto-fallback (default):**
```bash
curl "http://localhost:3001/api/srt?videoId=dQw4w9WgXcQ&lang=en"
```

**List available caption languages:**
```bash
curl "http://localhost:3001/api/transcript/languages?videoId=dQw4w9WgXcQ"
```

---

## Service implementation files

Two standalone service implementations live in `server/services/`:

| File | Library | Notes |
|---|---|---|
| `srt_fetch.js` | `youtube-transcript-plus` | Full express server on port 3000; supports SRT, VTT, JSON; filesystem cache via `FsCache` |
| `srt_fetch1.js` | `youtube-transcript-api-js` | Full express server on port 3002; supports SRT, VTT, JSON; mirrors `srt_fetch.js` interface |

These run independently and are not required by `index.js` (which inlines both strategies). They serve as standalone reference implementations and can be run on their own for testing or deployment.
