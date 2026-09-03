# Proxy Rotation, Fallback Logic, and YouTube Alternatives
## Implementation Guide

This guide covers the complete proxy rotation system, retry logic, logging infrastructure, and YouTube alternatives integrated into your voice recognition app.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Proxy Rotation System](#proxy-rotation-system)
3. [Retry & Fallback Logic](#retry--fallback-logic)
4. [Request Logging](#request-logging)
5. [YouTube Alternatives](#youtube-alternatives)
6. [Free Proxy Mechanisms (Tor, VPN, etc.)](#free-proxy-mechanisms)
7. [API Endpoints](#api-endpoints)
8. [Configuration Guide](#configuration-guide)
9. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. **Initialize Proxy Manager**
```javascript
const proxyManager = require('./server/services/proxy-manager');

// The system automatically initializes with 11 residential proxies
// Round-robin rotation starts immediately with automatic failover
```

### 2. **Execute Request with Proxy Fallback**
```javascript
const result = await proxyManager.executeWithProxyFallback(
  'video-123',  // groupId for logging
  'youtube-transcript',  // service name
  async (proxyUrl) => {
    // Your fetch function here
    return await fetchSrt(videoId, lang, proxyUrl);
  },
  {
    maxRetries: 4,
    timeout: 30000,
    useProxies: true,
  }
);
```

### 3. **View Logs & Statistics**
```bash
# Get proxy statistics
curl http://localhost:3001/api/proxy/stats

# Get request attempts for a video
curl "http://localhost:3001/api/proxy/requests?groupId=video-123"

# Get service configuration
curl http://localhost:3001/api/services/config
```

---

## Proxy Rotation System

### How It Works

1. **Round-Robin Selection**: Each request cycles through the proxy list
2. **Automatic Blacklisting**: Failed proxies are temporarily blacklisted (5s → 30s → 2m → 5m)
3. **Health Tracking**: Success/failure counts per proxy
4. **Fallback Chain**: If all proxies fail, automatically uses next proxy after blacklist period expires

### Proxy Pool (11 Residential IPs)

All proxies use credentials: `zhuwraee:cm4igg4nj86y`

```
31.59.20.176:6754
45.38.107.97:6014
198.105.121.200:6462
64.137.96.74:6641
198.23.243.226:6361
38.154.185.97:6370
84.247.60.125:6095
142.111.67.146:5611
191.96.254.138:6185
191.96.254.138:6185 (duplicate for redundancy)
31.58.9.4:6077
```

### Per-Proxy Health Tracking

Each proxy maintains:
- **Attempts**: Total requests attempted
- **Successes**: Successful responses
- **Failures**: Failed requests
- **Success Rate**: Calculated percentage
- **Status**: Healthy/Blacklisted
- **Blacklist Duration**: Progressive backoff timing
- **Last Used**: Timestamp of last attempt
- **Last Error**: Most recent error message

### Viewing Proxy Stats

```javascript
GET /api/proxy/stats
Response:
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
      "lastUsed": "2026-09-03T10:45:23.456Z",
      "lastError": null
    },
    // ... more proxies
  ],
  "summary": {
    "total": 11,
    "healthy": 10,
    "blacklisted": 1,
    "successRate": "94.32%"
  }
}
```

---

## Retry & Fallback Logic

### Exponential Backoff Algorithm

```
Attempt 0: Immediate (no delay)
Attempt 1: 1000ms × 2^0 = 1000ms (± 10% jitter)
Attempt 2: 1000ms × 2^1 = 2000ms (± 10% jitter)
Attempt 3: 1000ms × 2^2 = 4000ms (± 10% jitter)
Attempt 4: 1000ms × 2^3 = 8000ms (± 10% jitter)
Max: 30 seconds (caps exponential growth)
```

### Retry Configuration per Service

**youtube-transcript-api-js** (Recommended)
- Max Retries: 4
- Initial Delay: 1500ms
- Failure Threshold: [429, 503, 502]
- Timeout: 30s

**Invidious** (Fallback)
- Max Retries: 3
- Initial Delay: 2000ms
- Failure Threshold: [429, 503, 502]
- Timeout: 20s

**DownSub API** (Last Resort)
- Max Retries: 2
- Initial Delay: 3000ms
- Failure Threshold: [429, 503, 502]
- Timeout: 25s

### Request Flow Diagram

```
Request Attempt #1
    ↓
Use Proxy (Round-robin)
    ↓
Fetch with Timeout (30s)
    ├─ Success? → Mark proxy success, return result ✓
    ├─ Rate-limited (429)? → Mark proxy failed, retry
    ├─ Service unavailable (503)? → Mark proxy failed, retry
    ├─ Timeout? → Mark proxy failed, retry
    └─ Blacklist proxy, wait exponential backoff
    ↓
Request Attempt #2 (wait 1s + jitter)
    ↓
Next Proxy (skip blacklisted)
    ├─ Success? → ✓
    └─ Failed? → Continue...
    ↓
Request Attempt #3 (wait 2s + jitter)
    ├─ Success? → ✓
    └─ Failed? → Continue...
    ↓
Request Attempt #4 (wait 4s + jitter)
    ├─ Success? → ✓
    └─ Failed? → Throw Error ✗
```

---

## Request Logging

### Log Entry Structure

Each request attempt is logged with:

```javascript
{
  "timestamp": "2026-09-03T10:45:23.456Z",
  "groupId": "dQw4w9WgXcQ",              // videoId or operation ID
  "service": "youtube-transcript",       // service name
  "proxyUrl": "http://...@31.59.20.176:6754",
  "status": "attempt|success|retry|failed",
  "error": null,  // Error message if failed
  "durationMs": 1234  // Request time in ms
}
```

### Request Grouping

View all requests for a specific video:

```javascript
GET /api/proxy/requests?groupId=dQw4w9WgXcQ
Response:
{
  "groupId": "dQw4w9WgXcQ",
  "attempts": [
    { "timestamp": "...", "status": "attempt", "proxyUrl": "..." },
    { "timestamp": "...", "status": "success", "durationMs": 1500 }
  ],
  "total": 2,
  "grouped": {
    "dQw4w9WgXcQ": [
      // all attempts for this video
    ]
  }
}
```

### Real-Time Log Monitoring

Subscribe to request logs in your debug panel or use polling:

```javascript
// Poll for new logs every 2 seconds
setInterval(async () => {
  const res = await fetch('/api/proxy/requests?limit=100');
  const data = await res.json();
  console.log('Request attempts:', data.attempts);
}, 2000);
```

---

## YouTube Alternatives

### Recommended by Use Case

#### **For Language Learning** (Best Subtitles Quality)
1. **BBC Learning English** - Purpose-built for ESL learners
2. **TED Talks** - 60+ languages, professional content
3. **Invidious** - Full YouTube archive, any language pair

#### **For Privacy** (Zero Tracking)
1. **Invidious** - Privacy-focused YouTube clone
2. **PeerTube** - Federated, decentralized
3. **Tor + Invidious** - Maximum anonymity

#### **For Large Libraries**
1. **youtube-transcript-api-js** - Full YouTube access via proxy rotation
2. **Invidious** - All YouTube videos (public ones)
3. **Dailymotion** - Large alternative video platform

#### **For Best Subtitle Support**
1. **TED Talks** - Curated, professional translations (60+ languages)
2. **BBC Learning English** - Native English content for learners
3. **Vimeo** - Professional creators with quality subtitles

### Detailed Alternative Comparison

| Platform | Subtitles | Languages | API | Self-Host | Tor | Best For |
|----------|-----------|-----------|-----|-----------|-----|----------|
| **YouTube** | Excellent | 100+ | Yes (proxy needed) | No | No | Maximum content |
| **Invidious** | Excellent | 100+ | Yes | Yes | Yes | Privacy + content |
| **PeerTube** | Good | 50+ | Yes | Yes | Yes | Decentralization |
| **TED Talks** | Excellent | 60+ | Partial | No | Yes | Quality learning |
| **BBC Learning English** | Excellent | 1 (EN) | No | No | Yes | English learners |
| **Vimeo** | Good | 30+ | Yes (auth needed) | No | Limited | Professional content |
| **Odysee** | Fair | 20+ | Yes | No | Limited | Creator monetization |

### Integration Example: Invidious

```javascript
// Auto-fallback to Invidious when YouTube blocked
const transcript = await fetchTranscript(videoId, lang)
  .catch(err => {
    if (err.status === 429 || err.message.includes('blocked')) {
      // Try Invidious
      return fetchFromInvidious(videoId, lang);
    }
    throw err;
  });
```

### Public Invidious Instances (Ready to Use)

```javascript
const invidiousInstances = [
  'https://yewtu.be',                   // Global, reliable
  'https://invidious.snopyta.org',      // Europe
  'https://inv.riverside.rocks',        // US
  'https://invidious.silkky.cloud',     // Global
  'https://invidious.jing.rocks',       // Global
];
```

---

## Free Proxy Mechanisms

### Option 1: Tor Network (Maximum Privacy)

**Setup (macOS):**
```bash
brew install tor
tor  # Start in foreground
# Listening on localhost:9050 (SOCKS5)
```

**Setup (Linux):**
```bash
apt-get install tor
sudo service tor start
# Listening on localhost:9050
```

**Setup (Windows):**
```
1. Download Tor Browser from www.torproject.org
2. Extract and run Tor
3. Listen on localhost:9050
```

**Node.js Integration:**
```bash
npm install socks-proxy-agent
```

```javascript
const SocksProxyAgent = require('socks-proxy-agent');
const torAgent = new SocksProxyAgent('socks5://localhost:9050');

const response = await fetch(url, {
  agent: torAgent,
});
```

**Pros:**
- ✓ Completely free
- ✓ Maximum anonymity (multiple hops)
- ✓ No credentials needed
- ✓ Automatic exit node rotation

**Cons:**
- ✗ Slower than HTTP proxies (multiple hops)
- ✗ YouTube actively blocks Tor exit nodes
- ✗ Not ideal for video subtitle fetching

**Recommendation:** Use as fallback for privacy-critical operations, not primary YouTube access

### Option 2: Free Proxy Lists (Low Quality)

**Sources:**
```
https://free-proxy-list.net/
https://proxy-list.download/
https://proxylist.geonode.com/api/proxy-list/
```

**Integration:**
```javascript
// Fetch free proxy list
const res = await fetch('https://proxylist.geonode.com/api/proxy-list/');
const data = await res.json();
const freeProxies = data.data.map(p => `http://${p.ip}:${p.port}`);

// Rotate through free proxies
const proxy = freeProxies[Math.random() * freeProxies.length | 0];
```

**Pros:**
- ✓ No cost
- ✓ Large rotating pool
- ✓ Easy integration

**Cons:**
- ✗ Low reliability (many dead proxies)
- ✗ Slow response times
- ✗ YouTube detection/blocks
- ✗ Requires frequent health checks

**Recommendation:** Not recommended for production

### Option 3: Free VPN + SOCKS5 Tunnel

**VPN Services (Free Tier):**
- ProtonVPN (free tier available)
- Windscribe (free tier available)
- TunnelBear (free tier available)
- Hotspot Shield (free tier available)

**Setup:**
```bash
1. Install VPN client
2. Connect to VPN
3. Expose SOCKS5: privoxy or other bridge
4. Configure Node.js to use SOCKS5 proxy
```

**Pros:**
- ✓ Better than raw Tor for YouTube
- ✓ Free with decent bandwidth
- ✓ Multiple server locations
- ✓ Easier to switch servers

**Cons:**
- ✗ Still detected/blocked by YouTube
- ✗ Bandwidth limits on free tier
- ✗ Privacy depends on provider policy

**Recommendation:** Good fallback when paid proxies unavailable

### Option 4: Residential Proxy Rotation (Current Implementation)

**Currently Implemented:**
- ✓ 11 residential HTTP proxies with automatic rotation
- ✓ High success rate with YouTube
- ✓ Automatic blacklisting and failover
- ✓ Per-proxy health tracking
- ✓ Exponential backoff retries

**Cost:** Paid service ($0.50-$2 per GB typical)

**Recommendation:** Use for production; paid proxies are most reliable for video fetching

---

## API Endpoints

### Proxy Management

#### **GET /api/proxy/stats**
Returns proxy health statistics, success rates, and blacklist status.

```javascript
const stats = await fetch('/api/proxy/stats').then(r => r.json());
console.log(`${stats.summary.healthy}/${stats.summary.total} proxies healthy`);
console.log(`Overall success rate: ${stats.summary.successRate}`);
```

#### **GET /api/proxy/requests?groupId=VIDEO_ID&limit=50**
Returns grouped request attempts with timestamps, statuses, and error messages.

```javascript
const attempts = await fetch(
  '/api/proxy/requests?groupId=dQw4w9WgXcQ'
).then(r => r.json());

attempts.attempts.forEach(attempt => {
  console.log(`[${attempt.status}] ${attempt.service} via ${attempt.proxyUrl}`);
});
```

### Service Configuration

#### **GET /api/services/config**
Complete configuration for all YouTube transcript services.

```javascript
const config = await fetch('/api/services/config').then(r => r.json());
console.log(config.services); // Service capabilities
console.log(config.retryStrategy); // Multi-layer fallback
console.log(config.alternatives); // YouTube alternatives
```

#### **GET /api/services/ui-config/{service}**
UI configuration for a specific service (what fields to expose).

```javascript
const uiConfig = await fetch(
  '/api/services/ui-config/youtube-transcript-api-js'
).then(r => r.json());

console.log(uiConfig.uiConfig.showProxyOption); // true
console.log(uiConfig.uiConfig.showRetryConfig); // true
```

#### **GET /api/services/alternatives**
List of YouTube alternatives with features and setup instructions.

```javascript
const alternatives = await fetch(
  '/api/services/alternatives'
).then(r => r.json());

console.log(alternatives.recommended.languageLearning);
// → ['invidious', 'ted', 'bbc-learning-english']
```

---

## Configuration Guide

### Environment Variables

```bash
# .env
YOUTUBE_HTTP_PROXY=http://zhuwraee:cm4igg4nj86y@31.59.20.176:6754
YOUTUBE_INVIDIOUS_ENABLED=true
YOUTUBE_INVIDIOUS_INSTANCES=https://yewtu.be,https://inv.riverside.rocks
```

### Per-Service Configuration

Edit `server/services/youtube-service-config.js`:

```javascript
SERVICE_CONFIG["youtube-transcript-api-js"] = {
  retryConfig: {
    maxRetries: 4,           // Increase for unstable networks
    initialDelayMs: 1500,    // Delay before first retry
    failureThreshold: [429, 503, 502],  // HTTP codes to retry on
    timeout: 30000,          // Request timeout
  },
};
```

### Proxy Manager Configuration

Edit `server/services/proxy-manager.js`:

```javascript
const BACKOFF_CONFIG = {
  initialDelayMs: 1000,      // Starting retry delay
  maxDelayMs: 30000,         // Cap on exponential growth
  multiplier: 2,             // Double delay each retry
};

// Progressive blacklist durations
const blacklistDurations = [
  5000,    // 5 seconds after 1st failure
  30000,   // 30 seconds after 2nd failure
  120000,  // 2 minutes after 3rd failure
  300000,  // 5 minutes after 4th+ failures
];
```

---

## Troubleshooting

### Issue: All Proxies Blacklisted

**Symptom:** Request fails with "All proxies blacklisted"

**Solution:**
```javascript
// Check proxy stats
GET /api/proxy/stats

// Wait for blacklist period to expire (5s-5m depending on failure count)
// OR restart server to reset stats
```

### Issue: Consistently High Latency

**Symptom:** Requests take 10+ seconds to complete

**Cause:** YouTube rate-limiting or network issues

**Solution:**
```javascript
// Increase retry delay
BACKOFF_CONFIG.initialDelayMs = 2000;  // 2s instead of 1s

// Or reduce timeout if network is stable
timeout: 20000,  // 20s instead of 30s
```

### Issue: Invidious Instance Returns 404

**Symptom:** Video found on YouTube but not on Invidious instance

**Solution:**
```javascript
// Invidious instances don't always have all YouTube videos
// Try different instance
const instances = [
  'https://yewtu.be',
  'https://inv.riverside.rocks',
  'https://invidious.silkky.cloud',
];
```

### Issue: YouTube Detecting Bot Traffic

**Symptom:** 403 Forbidden or CAPTCHA after few requests

**Cause:** User-Agent or request patterns too obvious

**Solution:**
```javascript
// Rotate User-Agents
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120...',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) Firefox/121...',
];

// Use residential proxies (not datacenter)
// They look like normal user traffic
```

### Monitoring Request Logs

**Real-time debugging in browser console:**
```javascript
// Monitor proxy stats every 5 seconds
setInterval(async () => {
  const stats = await fetch('/api/proxy/stats').then(r => r.json());
  console.clear();
  console.table(stats.proxies);
}, 5000);

// Monitor specific video requests
setInterval(async () => {
  const log = await fetch(
    '/api/proxy/requests?groupId=dQw4w9WgXcQ'
  ).then(r => r.json());
  console.log('Latest attempts:', log.attempts.slice(-5));
}, 2000);
```

---

## Integration Checklist

- [x] Proxy manager service created (`proxy-manager.js`)
- [x] Service configuration documentation (`youtube-service-config.js`)
- [x] API endpoints for proxy stats (`/api/proxy/stats`)
- [x] API endpoints for request logs (`/api/proxy/requests`)
- [x] API endpoints for service config (`/api/services/config`)
- [x] API endpoints for YouTube alternatives (`/api/services/alternatives`)
- [ ] Integration into `youtube-transcript.js` (next step)
- [ ] UI panel for proxy stats display (next step)
- [ ] UI panel for service selection (next step)
- [ ] Tor SOCKS5 proxy support (optional)

---

## Next Steps

1. **Integrate with YouTube Transcript Service**: Modify `server/services/youtube-transcript.js` to use `proxyManager.executeWithProxyFallback()` for all HTTP requests

2. **Add UI Panels**:
   - Proxy stats panel showing health, success rates, blacklist status
   - Request log viewer grouped by videoId
   - Service selector (youtube-api-js vs Invidious)
   - YouTube alternative suggestions

3. **Optional Enhancements**:
   - Tor/SOCKS5 proxy support with `socks-proxy-agent`
   - Free proxy list integration with health checks
   - Custom proxy configuration UI
   - Request rate limiting configuration
   - Geographic proxy selection

---

## Questions?

- Check `/api/services/config` for complete documentation
- View request logs at `/api/proxy/requests`
- Monitor proxy health at `/api/proxy/stats`
- See Swagger UI at `http://localhost:3001/api-docs.json`
