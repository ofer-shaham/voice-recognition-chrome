function padN(n, len) { return String(n).padStart(len, "0"); }

function msToSrtTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const x = Math.floor(ms % 1000);
  return `${padN(h, 2)}:${padN(m, 2)}:${padN(s, 2)},${padN(x, 3)}`;
}

function segmentsToSrt(segments) {
  return segments
    .map((seg, i) => {
      const start = msToSrtTime(Math.round(seg.offset * 1000));
      const end = msToSrtTime(Math.round((seg.offset + seg.duration) * 1000));
      return `${i + 1}\n${start} --> ${end}\n${seg.text}`;
    })
    .join("\n\n");
}

const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

function decodeXml(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

async function fetchTimedText(url, { retries = 3, delayMs = 6000 } = {}) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.status === 429) {
      if (attempt === retries) throw new Error("YouTube rate-limited (429) after retries");
      await new Promise(ok => setTimeout(ok, delayMs * Math.pow(2, attempt)));
      continue;
    }
    if (!r.ok) throw new Error(`YouTube timedtext HTTP ${r.status}`);
    return r.text();
  }
}

async function ytPlayerData(videoId) {
  const watchPage = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
  });
  if (!watchPage.ok) throw new Error(`Watch page HTTP ${watchPage.status}`);
  const html = await watchPage.text();
  const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);
  // Key is optional in newer Innertube versions; fall back to empty string
  const apiKey = keyMatch ? keyMatch[1] : "";

  // Clients ordered from least bot-detected to most.
  // IOS and TVHTML5 work most reliably in serverless/Lambda environments.
  const clients = [
    { clientName: "IOS", clientVersion: "19.29.1", deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "17.5.1" },
    { clientName: "TVHTML5", clientVersion: "7.20240724.13.00", hl: "en", gl: "US" },
    { clientName: "WEB", clientVersion: "2.20240726.00.00", hl: "en", gl: "US" },
    { clientName: "ANDROID", clientVersion: "19.09.37" },
  ];

  let lastError = null;
  for (const client of clients) {
    try {
      const url = apiKey
        ? `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`
        : `https://www.youtube.com/youtubei/v1/player`;
      const playerRes = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "X-YouTube-Client-Name": client.clientName === "IOS" ? "5" : "1",
          "X-YouTube-Client-Version": client.clientVersion,
        },
        body: JSON.stringify({ context: { client }, videoId }),
      });
      if (!playerRes.ok) throw new Error(`Player API HTTP ${playerRes.status}`);
      const data = await playerRes.json();
      const status = data?.playabilityStatus?.status;
      const hasCaptions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length > 0;
      const hasTitle = !!data?.videoDetails?.title;
      // Accept if the video is playable OR if we got any video metadata / captions
      if (status === "OK" || hasCaptions || hasTitle) return data;
      lastError = new Error(`Client ${client.clientName} returned no usable data (status: ${status || "unknown"})`);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("All player clients failed");
}

async function ytCaptionBaseUrl(videoId) {
  const data = await ytPlayerData(videoId);
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) throw new Error("No caption tracks found");
  return tracks[0].baseUrl;
}

// ── Method 4: DownSub-hosted API (https://youtube-dl-jrte.onrender.com) ──────
// Third-party service that ports the DownSub crawler flow. Used as the new
// default: it also exposes a video-info/languages endpoint with a
// server-designated "default" language, which the UI uses to pre-select a
// track in the language dropdown.

const DOWNSUB_BASE = "https://youtube-dl-jrte.onrender.com";

function emitUpstreamLog(level, msg, meta = {}) {
  const logger = globalThis.__transcriptProxyLogger;
  if (typeof logger === "function") {
    logger(level, msg, meta);
    return;
  }
  const rest = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
  console.log(`[${level.toUpperCase()}] ${msg}${rest}`);
}

async function fetchDownsubJson(path, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${DOWNSUB_BASE}${path}?${qs}`;
  emitUpstreamLog("info", "downstream transcript request", { target: url, path });
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    emitUpstreamLog("warn", "downstream transcript request failed", { target: url, status: res.status, path, error: body.slice(0, 200) });
    throw new Error(`DownSub API ${path} HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  return res.json();
}

async function fetchVideoInfoDownsub(videoId) {
  const [info, defaults] = await Promise.all([
    fetchDownsubJson("/api/video-info", { url: videoId }),
    fetchDownsubJson("/api/default-transcript-languages", { videoID: videoId }).catch(() => []),
  ]);

  const manual = Array.isArray(info?.manualSubtitles) ? info.manualSubtitles : [];
  const auto = Array.isArray(info?.autoTranslatedSubtitles) ? info.autoTranslatedSubtitles : [];

  if (!manual.length && !auto.length) {
    throw new Error("DownSub API returned no subtitle tracks for this video");
  }

  const seen = new Set();
  const availableLanguages = [];
  for (const l of manual) {
    if (seen.has(l.code)) continue;
    seen.add(l.code);
    availableLanguages.push({
      languageCode: l.code,
      name: l.name && l.name !== "undefined" ? l.name : l.code,
      isAutoGenerated: /_auto$/i.test(l.code) || /auto-generated/i.test(l.name || ""),
    });
  }
  for (const l of auto) {
    if (seen.has(l.code)) continue;
    seen.add(l.code);
    availableLanguages.push({
      languageCode: l.code,
      name: l.name && l.name !== "undefined" ? l.name : l.code,
      isAutoGenerated: true,
    });
  }

  const defaultCode = defaults?.[0]?.code && seen.has(defaults[0].code)
    ? defaults[0].code
    : (availableLanguages.find(l => !l.isAutoGenerated)?.languageCode || availableLanguages[0].languageCode);

  for (const l of availableLanguages) l.isDefault = l.languageCode === defaultCode;

  return {
    videoDetails: { title: info?.title || null, videoId },
    availableLanguages,
    defaultLanguageCode: defaultCode,
  };
}

async function fetchSrtMethod4(videoId, langCode) {
  // Use download=1 to get raw SRT text directly, avoiding JSON field name guessing.
  const qs = new URLSearchParams({ url: videoId, language: langCode, type: "srt", autoTranslate: "1", download: "1" }).toString();
  const url = `${DOWNSUB_BASE}/api/subtitles?${qs}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DownSub API /api/subtitles HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
  }
  const text = await res.text();
  // Sanity check: a valid SRT must contain at least one --> timestamp marker
  if (!text.includes("-->")) throw new Error("DownSub API returned no valid SRT content");
  return text;
}

async function fetchSrt(videoId, langCode, method) {
  if (method && method !== "4") {
    throw new Error(`Deprecated transcript method '${method}' is no longer supported; only method 4 is available.`);
  }
  return fetchSrtMethod4(videoId, langCode);
}

module.exports = {
  ytPlayerData, ytCaptionBaseUrl, fetchSrt,
  fetchSrtMethod4, fetchVideoInfoDownsub, segmentsToSrt,
};
