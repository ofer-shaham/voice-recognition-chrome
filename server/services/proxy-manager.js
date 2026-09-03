/**
 * Proxy Manager Service
 * Handles:
 * - Round-robin proxy selection with rotation
 * - Automatic fallback on failed requests
 * - Exponential backoff retry with configurable delays
 * - Request attempt logging and grouping
 * - Per-proxy performance tracking
 */

// Default list of available HTTP proxies
const DEFAULT_PROXIES = [
  "http://zhuwraee:cm4igg4nj86y@31.59.20.176:6754",
  "http://zhuwraee:cm4igg4nj86y@45.38.107.97:6014",
  "http://zhuwraee:cm4igg4nj86y@198.105.121.200:6462",
  "http://zhuwraee:cm4igg4nj86y@64.137.96.74:6641",
  "http://zhuwraee:cm4igg4nj86y@198.23.243.226:6361",
  "http://zhuwraee:cm4igg4nj86y@38.154.185.97:6370",
  "http://zhuwraee:cm4igg4nj86y@84.247.60.125:6095",
  "http://zhuwraee:cm4igg4nj86y@142.111.67.146:5611",
  "http://zhuwraee:cm4igg4nj86y@191.96.254.138:6185",
  "http://zhuwraee:cm4igg4nj86y@31.58.9.4:6077",
];

// Track proxy health and performance
const proxyStats = {};

// Current round-robin index
let currentProxyIndex = 0;

// Request attempt log for grouping
const requestAttemptLog = [];
const REQUEST_LOG_MAX = 500;

// Backoff configuration
const BACKOFF_CONFIG = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
};

/**
 * Initialize proxy stats for all proxies
 */
function initProxyStats() {
  DEFAULT_PROXIES.forEach((proxy, idx) => {
    if (!proxyStats[proxy]) {
      proxyStats[proxy] = {
        index: idx,
        attempts: 0,
        successes: 0,
        failures: 0,
        lastError: null,
        lastUsed: null,
        isBlacklisted: false,
        blacklistedUntil: null,
      };
    }
  });
}

/**
 * Get next proxy in round-robin fashion
 * Skips blacklisted proxies
 */
function getNextProxy() {
  initProxyStats();
  
  const availableProxies = DEFAULT_PROXIES.filter(proxy => {
    const stats = proxyStats[proxy];
    if (!stats.isBlacklisted) return true;
    
    // Check if blacklist period has expired
    if (stats.blacklistedUntil && Date.now() > stats.blacklistedUntil) {
      stats.isBlacklisted = false;
      stats.blacklistedUntil = null;
      return true;
    }
    return false;
  });
  
  if (availableProxies.length === 0) {
    // All proxies blacklisted, reset and return first
    DEFAULT_PROXIES.forEach(proxy => {
      proxyStats[proxy].isBlacklisted = false;
      proxyStats[proxy].blacklistedUntil = null;
    });
    availableProxies.push(...DEFAULT_PROXIES);
  }
  
  currentProxyIndex = (currentProxyIndex + 1) % availableProxies.length;
  return availableProxies[currentProxyIndex];
}

/**
 * Calculate exponential backoff delay
 */
function getBackoffDelay(attemptNumber) {
  const delay = Math.min(
    BACKOFF_CONFIG.initialDelayMs * Math.pow(BACKOFF_CONFIG.multiplier, attemptNumber),
    BACKOFF_CONFIG.maxDelayMs
  );
  // Add jitter (±10%)
  return delay * (0.9 + Math.random() * 0.2);
}

/**
 * Log a request attempt
 */
function logRequestAttempt(groupId, service, proxyUrl, status, errorMessage, durationMs) {
  const entry = {
    timestamp: new Date().toISOString(),
    groupId,
    service,
    proxyUrl: proxyUrl ? proxyUrl.replace(/:[^@]*@/, ":***@") : "(direct)",
    status, // 'attempt', 'success', 'failed', 'retry', 'fallback'
    error: errorMessage || null,
    durationMs,
  };
  
  requestAttemptLog.push(entry);
  
  // Trim log if it gets too large
  if (requestAttemptLog.length > REQUEST_LOG_MAX) {
    requestAttemptLog.shift();
  }
  
  return entry;
}

/**
 * Get grouped request attempt log by groupId
 */
function getRequestAttempts(groupId = null, limit = 50) {
  let logs = requestAttemptLog;
  
  if (groupId) {
    logs = logs.filter(log => log.groupId === groupId);
  }
  
  return logs.slice(-limit);
}

/**
 * Get proxy statistics and health
 */
function getProxyStats() {
  initProxyStats();
  return Object.values(proxyStats).map(stat => ({
    ...stat,
    successRate: stat.attempts > 0 ? ((stat.successes / stat.attempts) * 100).toFixed(2) + "%" : "N/A",
    isHealthy: !stat.isBlacklisted && stat.successes > stat.failures,
  }));
}

/**
 * Mark proxy as failed
 * Blacklist for a period based on failure count
 */
function markProxyFailed(proxyUrl, error) {
  if (!proxyStats[proxyUrl]) return;
  
  const stats = proxyStats[proxyUrl];
  stats.failures++;
  stats.lastError = error.message || String(error);
  stats.lastUsed = new Date().toISOString();
  
  // Blacklist progressively: 5s, 30s, 2m, 5m
  const blacklistDurations = [5000, 30000, 120000, 300000];
  const duration = blacklistDurations[Math.min(stats.failures - 1, 3)];
  
  stats.isBlacklisted = true;
  stats.blacklistedUntil = Date.now() + duration;
}

/**
 * Mark proxy as successful
 */
function markProxySuccess(proxyUrl) {
  if (!proxyStats[proxyUrl]) return;
  
  const stats = proxyStats[proxyUrl];
  stats.successes++;
  stats.lastUsed = new Date().toISOString();
  
  // Reset failure count on success
  if (stats.failures > 0) {
    stats.failures = Math.max(0, stats.failures - 1);
  }
}

/**
 * Execute a fetch with proxy rotation and retry logic
 * 
 * @param {string} groupId - Unique ID to group related attempts (e.g., videoId)
 * @param {string} service - Service name for logging (e.g., "youtube-transcript")
 * @param {Function} fetchFn - Async function(proxyUrl) that performs the fetch
 * @param {object} options - Configuration options
 *   - maxRetries: Max retry attempts (default 3)
 *   - failureThreshold: HTTP status codes to treat as retriable (default [429, 503])
 *   - timeout: Request timeout in ms (default 30000)
 *   - useProxies: Whether to use proxy rotation (default true)
 * @returns {Promise} Result of successful fetch
 */
async function executeWithProxyFallback(
  groupId,
  service,
  fetchFn,
  {
    maxRetries = 3,
    failureThreshold = [429, 503],
    timeout = 30000,
    useProxies = true,
  } = {}
) {
  initProxyStats();
  
  let lastError = null;
  let lastProxyUrl = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const proxyUrl = useProxies ? getNextProxy() : null;
    lastProxyUrl = proxyUrl;
    
    const startTime = Date.now();
    const attemptStatus = attempt === 0 ? 'attempt' : 'retry';
    
    try {
      logRequestAttempt(groupId, service, proxyUrl, attemptStatus, null, 0);
      
      // Execute the fetch function
      const result = await Promise.race([
        fetchFn(proxyUrl),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), timeout)
        ),
      ]);
      
      const durationMs = Date.now() - startTime;
      logRequestAttempt(groupId, service, proxyUrl, 'success', null, durationMs);
      
      if (useProxies && proxyUrl) {
        markProxySuccess(proxyUrl);
      }
      
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      lastError = error;
      
      // Determine if this is retriable
      const isRetriable = attempt < maxRetries;
      const status = isRetriable ? 'retry' : 'failed';
      
      logRequestAttempt(
        groupId,
        service,
        proxyUrl,
        status,
        error.message || String(error),
        durationMs
      );
      
      if (useProxies && proxyUrl) {
        markProxyFailed(proxyUrl, error);
      }
      
      if (isRetriable) {
        // Exponential backoff before retry
        const delayMs = getBackoffDelay(attempt);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw new Error(
    `Failed after ${maxRetries + 1} attempts using ${useProxies ? 'proxy rotation' : 'direct connection'}: ${lastError.message}`
  );
}

module.exports = {
  getNextProxy,
  executeWithProxyFallback,
  logRequestAttempt,
  getRequestAttempts,
  getProxyStats,
  markProxyFailed,
  markProxySuccess,
  DEFAULT_PROXIES,
};
