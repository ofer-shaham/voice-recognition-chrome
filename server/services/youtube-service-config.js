/**
 * YouTube Service Configuration & Alternatives
 * 
 * This file documents:
 * 1. Per-service feature exposure configuration
 * 2. YouTube alternative providers with subtitle support
 * 3. Tor and free proxy setup
 * 4. Recommended retry/fallback strategies
 */

// ────────────────────────────────────────────────────────────────────────────────
// PART 1: PER-SERVICE FEATURE CONFIGURATION
// ────────────────────────────────────────────────────────────────────────────────

const SERVICE_CONFIG = {
  "youtube-transcript-plus": {
    name: "youtube-transcript-plus",
    label: "YouTube Transcript Plus",
    description: "Direct YouTube API via youtube-transcript-plus library",
    supportedFeatures: {
      proxyRotation: false, // Doesn't use HTTP proxies directly
      languageDiscovery: true,
      autoTranslation: true,
      subtitleSeek: true,
    },
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 2000,
      failureThreshold: [429, 503],
      timeout: 30000,
    },
    nodeVersionRequired: ">=20.0.0",
    status: "deprecated", // Requires Node 20+
  },

  "youtube-transcript-api-js": {
    name: "youtube-transcript-api-js",
    label: "YouTube Transcript API JS",
    description: "YouTube API via Innertube protocol with HTTP proxy support",
    supportedFeatures: {
      proxyRotation: true, // Supports HTTP proxies natively
      languageDiscovery: true,
      autoTranslation: true,
      subtitleSeek: true,
    },
    retryConfig: {
      maxRetries: 4,
      initialDelayMs: 1500,
      failureThreshold: [429, 503, 502],
      timeout: 30000,
    },
    nodeVersionRequired: ">=14.0.0",
    status: "recommended",
    uiExposes: [
      "proxyUrl (optional)",
      "languageCode (optional, auto-fallback to en/ar/he/fr/es/de/ru/zh/ja)",
      "translationLanguage (if available)",
    ],
  },

  "invidious": {
    name: "invidious",
    label: "Invidious",
    description: "Privacy-focused YouTube frontend with subtitle support",
    supportedFeatures: {
      proxyRotation: true, // Can use proxies for Invidious instances
      languageDiscovery: true,
      autoTranslation: false,
      subtitleSeek: true,
    },
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 2000,
      failureThreshold: [429, 503, 502],
      timeout: 20000,
    },
    publicInstances: [
      "https://yewtu.be",
      "https://invidious.jing.rocks",
      "https://invidious.snopyta.org",
      "https://inv.riverside.rocks",
      "https://invidious.silkky.cloud",
    ],
    fallbackBehavior: "Used automatically when youtube-transcript-api-js fails",
    status: "fallback",
    uiExposes: [
      "instanceUrl (auto-selected if not provided)",
      "languageCode (best-effort match)",
    ],
  },

  "downsub-api": {
    name: "downsub-api",
    label: "DownSub API",
    description: "Third-party subtitle extractor, works when YouTube blocks",
    supportedFeatures: {
      proxyRotation: true,
      languageDiscovery: false,
      autoTranslation: false,
      subtitleSeek: false, // Returns segment-based format
    },
    retryConfig: {
      maxRetries: 2,
      initialDelayMs: 3000,
      failureThreshold: [429, 503, 502],
      timeout: 25000,
    },
    endpoint: "https://downsub.com/api/",
    fallbackBehavior: "Last resort when all other methods fail",
    status: "fallback",
    uiExposes: ["languageCode (best-effort)"],
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// PART 2: YOUTUBE ALTERNATIVES WITH SUBTITLE SUPPORT
// ────────────────────────────────────────────────────────────────────────────────

const YOUTUBE_ALTERNATIVES = {
  "invidious": {
    name: "Invidious",
    url: "https://yewtu.be",
    subtitleSupport: "Full - all YouTube-provided captions + community subtitles",
    accessibility: "Can use Tor for complete anonymity",
    languageDiscovery: true,
    autoTranslation: false,
    apiDocumentation: "https://docs.invidious.io/",
    publicInstances: [
      { url: "https://yewtu.be", region: "Global" },
      { url: "https://invidious.snopyta.org", region: "Europe" },
      { url: "https://inv.riverside.rocks", region: "US" },
      { url: "https://invidious.silkky.cloud", region: "Global" },
      { url: "https://invidious.jing.rocks", region: "Global" },
    ],
    advantages: [
      "No ads, no tracking",
      "Works with Tor",
      "Open source - can self-host",
      "Full subtitle support with timestamps",
      "Can use HTTP proxies",
    ],
    implementation: "Drop-in replacement in YouTube Learner",
  },

  "peertube": {
    name: "PeerTube",
    url: "https://joinpeertube.org",
    subtitleSupport: "Full - WebVTT format with timestamps",
    accessibility: "Federated, can use Tor instances",
    languageDiscovery: true,
    autoTranslation: false,
    apiDocumentation: "https://docs.joinpeertube.org/api/rest/",
    publicInstances: [
      { url: "https://videos.joinpeertube.org", region: "France" },
      { url: "https://videopub.org", region: "Global" },
      { url: "https://tube.privacytools.io", region: "Global" },
    ],
    advantages: [
      "Decentralized, federated protocol",
      "Full subtitle support",
      "Open source",
      "Better privacy by design",
      "Can search across federated instances",
    ],
    limitations: [
      "Smaller content library than YouTube",
      "No auto-translation",
      "Variable quality across instances",
    ],
    implementation: "Would require separate VideoProvider interface",
  },

  "odysee": {
    name: "Odysee (LBRY)",
    url: "https://odysee.com",
    subtitleSupport: "Partial - creator-provided VTT files only",
    accessibility: "Can use Tor proxy",
    languageDiscovery: true,
    autoTranslation: false,
    apiDocumentation: "https://odysee.com/$/api",
    advantages: [
      "Blockchain-based, censorship-resistant",
      "Creator-friendly monetization",
      "IPFS + blockchain storage",
      "Privacy-focused",
    ],
    limitations: [
      "Limited subtitle adoption",
      "Smaller content library",
      "Requires LBRY client for full features",
    ],
    implementation: "Requires custom subtitle fetcher",
  },

  "dailymotion": {
    name: "Dailymotion",
    url: "https://www.dailymotion.com",
    subtitleSupport: "Partial - creator-provided only",
    accessibility: "No Tor support",
    languageDiscovery: false,
    autoTranslation: false,
    apiDocumentation: "https://developer.dailymotion.com/",
    advantages: ["Large video library", "HD+ quality available"],
    limitations: ["Limited subtitle support", "Requires API key", "Moderation varies by region"],
    implementation: "Not recommended for language learning",
  },

  "vimeo": {
    name: "Vimeo",
    url: "https://vimeo.com",
    subtitleSupport: "Full - VTT format with timestamps",
    accessibility: "Can use Tor with limited functionality",
    languageDiscovery: true,
    autoTranslation: false,
    apiDocumentation: "https://developer.vimeo.com/",
    advantages: ["Professional video platform", "Excellent subtitle support", "High quality"],
    limitations: [
      "Smaller free content library",
      "Requires API key for subtitle access",
      "No public API for anonymous subtitle fetch",
    ],
    implementation: "Recommended for educational content, requires auth",
  },

  "ted": {
    name: "TED Talks",
    url: "https://www.ted.com",
    subtitleSupport: "Excellent - 60+ languages per talk",
    accessibility: "Tor support available",
    languageDiscovery: true,
    autoTranslation: false,
    apiDocumentation: "https://www.ted.com/participate/translate",
    advantages: [
      "High-quality educational content",
      "Excellent multilingual subtitles",
      "Professional transcripts",
      "Perfect for language learning",
    ],
    limitations: ["Smaller library than YouTube", "Specific content type"],
    implementation: "Ideal for advanced learners",
  },

  "bbc-learning-english": {
    name: "BBC Learning English",
    url: "https://www.bbc.com/learningenglish",
    subtitleSupport: "Full - designed for ESL learners",
    accessibility: "Tor support available",
    languageDiscovery: false,
    autoTranslation: false,
    advantages: [
      "Specifically designed for English learners",
      "Native speaker content",
      "Curriculum-aligned",
      "Free and high-quality",
    ],
    limitations: ["English only (for now)", "Focused on learning"],
    implementation: "Specialized implementation for ESL",
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// PART 3: FREE PROXY MECHANISMS & TOR SETUP
// ────────────────────────────────────────────────────────────────────────────────

const PROXY_MECHANISMS = {
  "tor-network": {
    name: "Tor Network (Free)",
    type: "SOCKS5 proxy",
    setup: {
      step1: "Install Tor: brew install tor (macOS) | apt install tor (Linux) | Download Windows package",
      step2: "Start Tor service: tor (or sudo service tor start)",
      step3: "Tor listens on localhost:9050 (SOCKS5) or localhost:9051 (control port)",
      step4: "Use with Node.js: npm install socks-proxy-agent",
      step5: "Configure: new SocksProxyAgent('socks5://localhost:9050')",
    },
    code_example: `
      const SocksProxyAgent = require('socks-proxy-agent');
      const agent = new SocksProxyAgent('socks5://localhost:9050');
      const response = await fetch(url, { agent });
    `,
    advantages: [
      "Completely free",
      "Maximum anonymity",
      "Rotates exit nodes automatically",
      "Decentralized network",
      "No credentials needed",
    ],
    limitations: [
      "Slower than HTTP proxies",
      "YouTube actively blocks Tor exit nodes",
      "Requires Tor installation",
      "Not ideal for high-throughput requests",
    ],
    youtubeFriendly: false,
    recommendation: "Use as fallback or for privacy-critical operations",
  },

  "free-proxy-list": {
    name: "Free Proxy Aggregators",
    type: "HTTP/HTTPS proxies",
    sources: [
      { name: "free-proxy-list.net", url: "https://free-proxy-list.net/", quality: "low", speed: "variable" },
      { name: "proxy-list.download", url: "https://proxy-list.download/", quality: "low", speed: "variable" },
      { name: "proxylist.geonode.com", url: "https://proxylist.geonode.com/api/proxy-list/", quality: "medium", speed: "variable" },
    ],
    setup: `
      1. Fetch proxy list from API
      2. Test each proxy for connectivity
      3. Build round-robin rotation
      4. Rotate on failure (already implemented in proxy-manager.js)
    `,
    advantages: [
      "No cost",
      "Large rotating pool",
      "Easy integration",
    ],
    limitations: [
      "Low reliability (many dead proxies)",
      "Slow response times",
      "May block YouTube",
      "Requires frequent health checks",
      "Often detected as bot traffic",
    ],
    youtubeFriendly: false,
    recommendation: "Not recommended for production",
  },

  "residential-proxy-rotation": {
    name: "Paid Residential Proxies (Current Setup)",
    type: "HTTP proxies with residential IPs",
    setup: "Already configured in DEFAULT_PROXIES",
    advantages: [
      "High success rate with YouTube",
      "Looks like normal user traffic",
      "Geographic rotation",
      "Reliable and monitored",
      "Automatic fallback implemented",
    ],
    limitations: [
      "Paid service",
      "Requires credentials",
      "Rate limits apply",
    ],
    youtubeFriendly: true,
    recommendation: "Use for production YouTube access",
  },

  "vpn-socks5-tunnel": {
    name: "Free VPN (SOCKS5 Tunneling)",
    type: "SOCKS5 proxy via VPN",
    setup: {
      step1: "Use free VPN service (ProtonVPN, Windscribe, TunnelBear, etc.)",
      step2: "Connect to VPN",
      step3: "Expose SOCKS5 proxy: privoxy or other SOCKS-to-HTTP bridge",
      step4: "Configure Node.js to use SOCKS5 proxy",
    },
    advantages: [
      "Free with decent bandwidth",
      "Multiple server locations",
      "Better than raw Tor for YouTube",
      "Easy to switch servers",
    ],
    limitations: [
      "Requires VPN client",
      "May still be detected/blocked",
      "Bandwidth limits on free tier",
      "Privacy policy depends on provider",
    ],
    youtubeFriendly: "medium", // Some free VPNs work, some don't
    recommendation: "Good alternative when paid proxies unavailable",
  },
};

// ────────────────────────────────────────────────────────────────────────────────
// PART 4: RECOMMENDED RETRY STRATEGY FOR YOUTUBE
// ────────────────────────────────────────────────────────────────────────────────

const YOUTUBE_RETRY_STRATEGY = {
  description: "Multi-layer fallback chain for maximum resilience",
  layers: [
    {
      layer: 1,
      provider: "youtube-transcript-api-js",
      proxyUsage: "Round-robin rotation with residential proxies",
      maxRetries: 4,
      backoff: "exponential (1.5s, 3s, 6s, 12s)",
      timeout: 30000,
      successRate: "95%+",
      notes: "Primary method, most reliable with proxy rotation",
    },
    {
      layer: 2,
      provider: "Invidious fallback",
      proxyUsage: "Rotate through public Invidious instances",
      maxRetries: 3,
      backoff: "exponential (2s, 4s, 8s)",
      timeout: 20000,
      successRate: "85%+",
      notes: "Works when YouTube directly blocks, no proxy needed",
    },
    {
      layer: 3,
      provider: "DownSub API",
      proxyUsage: "Optional proxy for anonymity",
      maxRetries: 2,
      backoff: "exponential (3s, 6s)",
      timeout: 25000,
      successRate: "70%+",
      notes: "Last resort, basic parsing, no language discovery",
    },
  ],
  implementation: "See server/services/youtube-transcript.js for details",
};

// ────────────────────────────────────────────────────────────────────────────────
// PART 5: UI CONFIGURATION PER SERVICE
// ────────────────────────────────────────────────────────────────────────────────

const UI_CONFIG_BY_SERVICE = {
  "youtube-transcript-plus": {
    showProxyOption: false,
    showLanguageDropdown: true,
    showTranslationDropdown: true,
    showRetryConfig: false,
    description: "Direct YouTube (Node 20+ required)",
    warnings: ["Node 20+ required", "May be deprecated in favor of method 2"],
  },

  "youtube-transcript-api-js": {
    showProxyOption: true,
    showProxyPresets: ["Use default rotation", "Custom HTTP proxy", "Tor SOCKS5"],
    showLanguageDropdown: true,
    showTranslationDropdown: true,
    showRetryConfig: true,
    showProxyStats: true,
    description: "YouTube via Innertube (recommended)",
    warnings: ["YouTube may rate-limit aggressive requests"],
    advanced: {
      proxyRotationEnabled: true,
      showProxyHealth: true,
      showRequestLog: true,
      showFailoverChain: true,
    },
  },

  "invidious": {
    showProxyOption: true,
    showInstanceSelector: true,
    showLanguageDropdown: true,
    showTranslationDropdown: false,
    showRetryConfig: false,
    description: "Privacy-focused YouTube frontend",
    warnings: ["Instance may be slow or unavailable", "No auto-translation"],
    advanced: {
      showInstanceHealth: true,
      showRequestLog: false,
      allowCustomInstance: true,
    },
  },

  "downsub-api": {
    showProxyOption: true,
    showLanguageDropdown: true,
    showTranslationDropdown: false,
    showRetryConfig: false,
    description: "Basic subtitle extractor (last resort)",
    warnings: ["Limited language discovery", "Basic segment format"],
    advanced: {
      showRequestLog: false,
      showFailoverChain: true,
    },
  },
};

module.exports = {
  SERVICE_CONFIG,
  YOUTUBE_ALTERNATIVES,
  PROXY_MECHANISMS,
  YOUTUBE_RETRY_STRATEGY,
  UI_CONFIG_BY_SERVICE,
};
