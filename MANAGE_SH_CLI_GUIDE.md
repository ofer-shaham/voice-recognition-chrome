# manage.sh CLI Operations Guide
## Reusable Functions for Proxy & Subtitle Management

This guide documents the new CLI commands added to `manage.sh` for managing proxy rotation and subtitle fetching operations.

---

## Quick Reference

### Proxy Management

```bash
./manage.sh proxy:stats              # Show proxy health and success rates
./manage.sh proxy:requests           # Show all request attempts
./manage.sh proxy:requests VIDEO_ID  # Show requests for specific video
./manage.sh proxy:report             # Detailed performance report
./manage.sh proxy:reset              # Reset proxy blacklists
```

### Subtitle Testing

```bash
./manage.sh subtitle:test VIDEO_ID [LANG]  # Test subtitle fetch
./manage.sh subtitle:health                # Overall health check
./manage.sh subtitle:cache                 # View subtitle cache info
```

---

## Proxy Management Commands

### `./manage.sh proxy:stats`

**Purpose:** Display proxy pool health and statistics

**Output:** JSON with proxy metrics
- Proxy URL (credentials masked)
- Attempts, successes, failures
- Success rate percentage
- Blacklist status and duration
- Last used timestamp

**Example:**
```bash
$ ./manage.sh proxy:stats

── Proxy Health & Statistics ──
{
  "proxies": [
    {
      "index": 0,
      "url": "http://...@31.59.20.176:6754",
      "attempts": 42,
      "successes": 40,
      "failures": 2,
      "successRate": "95.24%",
      "isHealthy": true,
      "isBlacklisted": false,
      "lastUsed": "2026-09-03T10:45:23Z"
    }
  ],
  "summary": {
    "total": 11,
    "healthy": 10,
    "blacklisted": 1,
    "successRate": "94.32%"
  }
}
```

**Use Cases:**
- Monitor overall proxy health
- Identify failed proxies
- Check which proxies are blacklisted
- Verify proxy rotation is working

---

### `./manage.sh proxy:requests [VIDEO_ID] [LIMIT]`

**Purpose:** View request attempt logs grouped by video

**Arguments:**
- `VIDEO_ID` (optional): Filter by specific YouTube video ID
- `LIMIT` (optional): Number of records to return (default: 50)

**Output:** Timestamped log of all fetch attempts with status, service, proxy, and duration

**Examples:**

```bash
# Show last 50 attempts across all videos
$ ./manage.sh proxy:requests

# Show attempts for specific video
$ ./manage.sh proxy:requests dQw4w9WgXcQ

# Show last 100 attempts for specific video
$ ./manage.sh proxy:requests dQw4w9WgXcQ 100

── Request Attempt Log ──
{
  "attempts": [
    {
      "timestamp": "2026-09-03T10:45:23.456Z",
      "groupId": "dQw4w9WgXcQ",
      "service": "youtube-transcript",
      "proxyUrl": "http://...@31.59.20.176:6754",
      "status": "attempt",
      "durationMs": 0
    },
    {
      "timestamp": "2026-09-03T10:45:25.123Z",
      "groupId": "dQw4w9WgXcQ",
      "service": "youtube-transcript",
      "proxyUrl": "http://...@31.59.20.176:6754",
      "status": "failed",
      "error": "HTTP 429 - Rate limited",
      "durationMs": 1867
    },
    {
      "timestamp": "2026-09-03T10:45:26.456Z",
      "groupId": "dQw4w9WgXcQ",
      "service": "invidious",
      "proxyUrl": "https://yewtu.be",
      "status": "success",
      "durationMs": 1234
    }
  ]
}
```

**Use Cases:**
- Troubleshoot failed subtitle fetches
- See which fallback layer succeeded
- Analyze performance per proxy
- Track retry attempts and delays
- Identify patterns in failures

---

### `./manage.sh proxy:report`

**Purpose:** Generate comprehensive proxy performance report

**Output:** Multi-section report showing:
- Summary (total, healthy, blacklisted, overall success rate)
- All proxies sorted by success rate
- Blacklisted proxies with expiration time

**Example:**
```bash
$ ./manage.sh proxy:report

── Proxy Performance Report ──

=== PROXY POOL HEALTH ===
total: 11
healthy: 10
blacklisted: 1
successRate: "94.32%"

=== INDIVIDUAL PROXY STATUS ===
31.59.20.176:6754: 95.24% success (40/42 attempts)
45.38.107.97:6014: 93.10% success (27/29 attempts)
198.105.121.200:6462: 91.67% success (22/24 attempts)
[... more proxies ...]

=== BLACKLISTED PROXIES ===
84.247.60.125:6095: blacklisted until 2026-09-03T10:52:15Z
```

**Use Cases:**
- Performance review
- Identify consistently failing proxies
- Plan proxy rotation tuning
- Submit diagnostics for support

---

### `./manage.sh proxy:reset`

**Purpose:** Reset proxy blacklist and counters

**Status:** Currently informational (restart server to reset)

**How to implement:**
Add this endpoint to `server/index.js`:
```javascript
app.post("/api/proxy/reset", (req, res) => {
  // Reset all proxy stats
  // Clear blacklists
  // Return confirmation
});
```

---

## Subtitle Fetch Commands

### `./manage.sh subtitle:test VIDEO_ID [LANGUAGE]`

**Purpose:** Test the complete fallback chain for subtitle fetching

**Arguments:**
- `VIDEO_ID` (required): YouTube video ID
- `LANGUAGE` (optional): Language code (default: en)

**What it does:**
1. Attempts to fetch subtitles via Layer 1 (YouTube + residential proxies)
2. If Layer 1 fails, shows that Layer 2 (Invidious) would be tried
3. Shows request log with all attempts

**Example:**
```bash
$ ./manage.sh subtitle:test dQw4w9WgXcQ en

── Testing Subtitle Fetch (All Layers) ──
[INFO] Testing subtitle fetch for: dQw4w9WgXcQ (language: en)

Layer 1: YouTube API + Residential Proxy
  Attempting to fetch via youtube-transcript-api-js...
  HTTP Status: 200
  Time: 1.523s
[INFO] ✓ Layer 1 Success
  Got 287 lines of subtitle data

Request details:
  2026-09-03T10:45:23.456Z: [success] youtube-transcript - 1523ms
```

**Use Cases:**
- Verify subtitle fetch is working
- Test new YouTube videos
- Diagnose fetch failures
- Benchmark performance

---

### `./manage.sh subtitle:health`

**Purpose:** Overall health check for subtitle fetching system

**Checks:**
- Server connectivity
- Proxy pool status (health, success rate)
- Recent request attempts
- Current service availability

**Example:**
```bash
$ ./manage.sh subtitle:health

── YouTube Subtitle Fetch Health Check ──
[INFO] Checking server health...
{
  "ok": true,
  "timestamp": 1725360323456,
  "startedAt": 1725359923456,
  "age": "6m 40s",
  "uptime": 400
}

[INFO] Checking proxy pool status...
{
  "total": 11,
  "healthy": 10,
  "blacklisted": 1,
  "successRate": "94.32%"
}

[INFO] Recent request attempts:
2026-09-03T10:45:26.456Z: [success] youtube-transcript
2026-09-03T10:45:15.234Z: [retry] youtube-transcript
2026-09-03T10:45:10.123Z: [success] invidious
```

**Use Cases:**
- Verify system is operational before tasks
- Monitor overall health
- Check for service degradation
- Quick status check

---

### `./manage.sh subtitle:cache`

**Purpose:** Inspect subtitle cache information

**Shows:**
- Cache location
- Total cache size
- Number of cached files
- Recently cached files (timestamps)

**Example:**
```bash
$ ./manage.sh subtitle:cache

── Subtitle Cache Information ──
[INFO] Cache found at: /path/to/server/services/youtube-transcript-cache
[INFO] Cache size: 125.4M
[INFO] Files cached: 1247

=== Cached Subtitle Files ===
2026-09-03 10:45  dQw4w9WgXcQ_en.srt
2026-09-03 10:34  dQw4w9WgXcQ_es.srt
2026-09-03 10:23  3jZ_D2IO2uE_en.srt
...
```

**Use Cases:**
- Monitor cache growth
- Clear old cache if needed
- Verify cache is being used
- Estimate storage usage

---

## Real-World Scenarios

### Scenario 1: "Subtitles are slow to fetch"

```bash
# Check if proxies are healthy
$ ./manage.sh proxy:stats
# → Check success rate and blacklisted proxies

# Test specific video
$ ./manage.sh subtitle:test dQw4w9WgXcQ
# → Benchmark actual fetch time

# View detailed request log
$ ./manage.sh proxy:requests dQw4w9WgXcQ
# → See which layer handled it and timing breakdown
```

**Solution options:**
- If Layer 1 blacklisted, wait for blacklist to expire
- If Layer 2 (Invidious) used, proxy was blocked
- If Layer 3 used, both Layer 1 & 2 failed

---

### Scenario 2: "Some videos fail to fetch"

```bash
# Get overall health
$ ./manage.sh subtitle:health
# → Check proxy pool health

# Test the problem video
$ ./manage.sh subtitle:test PROBLEM_VIDEO
# → See which layer fails

# View all attempts for that video
$ ./manage.sh proxy:requests PROBLEM_VIDEO
# → Analyze error messages
```

**Solution options:**
- Video might not be on Invidious (rare videos)
- All proxies might be blacklisted (wait or rotate)
- Invidious instance might be down (try different one)

---

### Scenario 3: "Monitor proxy performance over time"

```bash
# Create monitoring loop
watch -n 10 './manage.sh proxy:stats | jq .summary'

# Or check specific proxy
./manage.sh proxy:report | grep "31.59.20.176"

# Track request volume
watch -n 30 './manage.sh proxy:requests | jq ".total"'
```

---

### Scenario 4: "Automate health checks"

```bash
#!/bin/bash
# health-check.sh - Run every 5 minutes

if ! ./manage.sh subtitle:health > /dev/null 2>&1; then
  echo "YouTube subtitle fetching unhealthy!"
  ./manage.sh proxy:report | mail -s "Proxy Alert" admin@example.com
fi
```

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Subtitle Fetch Health

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes

jobs:
  health-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: ./manage.sh install
      - run: ./manage.sh --native start &
      - run: sleep 10
      - run: ./manage.sh subtitle:health
      - run: ./manage.sh proxy:report
```

---

## Command Reference

| Command | Purpose | Output | Args |
|---------|---------|--------|------|
| `proxy:stats` | Proxy pool health | JSON | - |
| `proxy:requests` | Request log | JSON | [videoId] [limit] |
| `proxy:report` | Performance report | Text | - |
| `proxy:reset` | Reset stats | Info | - |
| `subtitle:test` | Test fetch | Text + JSON | videoId [lang] |
| `subtitle:health` | System health | JSON | - |
| `subtitle:cache` | Cache info | Text | - |

---

## Troubleshooting CLI Commands

### "Cannot connect to server"

```
Error: Cannot connect to server at http://localhost:3001

Solution:
$ ./manage.sh start       # Start server if not running
$ ./manage.sh status      # Check server status
```

### "jq not found"

```
jq: command not found

Solution:
# Install jq
# macOS
brew install jq

# Linux
sudo apt-get install jq

# Or use raw curl
curl http://localhost:3001/api/proxy/stats
```

### "Permission denied"

```
./manage.sh: permission denied

Solution:
chmod +x manage.sh
./manage.sh proxy:stats
```

---

## Environment Variables

Set `SERVER_URL` to point to a different server:

```bash
# Default
./manage.sh proxy:stats
# → Uses http://localhost:3001

# Custom server
SERVER_URL=https://api.example.com:3001 ./manage.sh proxy:stats
# → Uses https://api.example.com:3001
```

---

## Adding New Commands

To add a new CLI command, follow this pattern:

```bash
# 1. Define function
my_command() {
  head_ "My Command"
  # Function implementation
}

# 2. Add to command dispatch
if [[ "$COMMAND" == "myservice" ]]; then
  case "$SUBCOMMAND" in
    mycommand) my_command "${COMMAND_ARGS[@]}" ;;
  esac
  exit $?
fi

# 3. Update usage documentation at top
# Usage: ./manage.sh myservice:mycommand [ARGS]
```

---

## Best Practices

1. **Run health check before batch operations**
   ```bash
   ./manage.sh subtitle:health && bulk-fetch-job.sh
   ```

2. **Monitor requests during high load**
   ```bash
   ./manage.sh proxy:requests VIDEO_ID | grep failed
   ```

3. **Regular proxy performance reviews**
   ```bash
   0 * * * * ./manage.sh proxy:report > /var/log/proxy-report-$(date +\%Y\%m\%d).log
   ```

4. **Archive logs for trend analysis**
   ```bash
   ./manage.sh proxy:requests | jq . >> /var/log/subtitle-requests.jsonl
   ```

5. **Alert on proxy degradation**
   ```bash
   RATE=$(./manage.sh proxy:stats | jq .summary.successRate | tr -d '%')
   if (( $(echo "$RATE < 80" | bc -l) )); then
     echo "WARNING: Proxy success rate below 80%"
   fi
   ```

---

## See Also

- [YOUTUBE_SUBTITLE_FETCHING_GUIDE.md](YOUTUBE_SUBTITLE_FETCHING_GUIDE.md) - Architecture overview
- [server/services/proxy-manager.js](server/services/proxy-manager.js) - Implementation
- `curl http://localhost:3001/api-docs.json` - Full API documentation
