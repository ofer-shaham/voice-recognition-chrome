const { fetchTranscript } = require("youtube-transcript-plus");

function padN(n, len) { return String(n).padStart(len, "0"); }

function msToSrtTime(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const x = Math.floor(ms % 1000);
  return `${padN(h,2)}:${padN(m,2)}:${padN(s,2)},${padN(x,3)}`;
}

function segmentsToSrt(segments) {
  return segments
    .map((seg, i) => {
      const start = msToSrtTime(Math.round(seg.offset * 1000));
      const end   = msToSrtTime(Math.round((seg.offset + seg.duration) * 1000));
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
    { clientName: "IOS",      clientVersion: "19.29.1",           deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "17.5.1" },
    { clientName: "TVHTML5",  clientVersion: "7.20240724.13.00",  hl: "en", gl: "US" },
    { clientName: "WEB",      clientVersion: "2.20240726.00.00",  hl: "en", gl: "US" },
    { clientName: "ANDROID",  clientVersion: "19.09.37" },
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
      const status      = data?.playabilityStatus?.status;
      const hasCaptions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length > 0;
      const hasTitle    = !!data?.videoDetails?.title;
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
  const data   = await ytPlayerData(videoId);
  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) throw new Error("No caption tracks found");
  return tracks[0].baseUrl;
}

async function fetchSrtMethod1(videoId, langCode) {
  try {
    const segments = await fetchTranscript(String(videoId), { lang: langCode });
    return segmentsToSrt(segments);
  } catch {
    // exact lang not available — fall through to tlang approach
  }
  const baseUrl      = await ytCaptionBaseUrl(String(videoId));
  const timedtextUrl = baseUrl.replace(/&fmt=[^&]*/g, "") + `&tlang=${langCode}`;
  const xml          = await fetchTimedText(timedtextUrl);
  const matches      = [...xml.matchAll(RE_XML_TRANSCRIPT)];
  if (!matches.length) throw new Error("No segments parsed from timedtext XML");
  const segments = matches.map(m => ({
    text:     decodeXml(m[3]),
    duration: parseFloat(m[2]),
    offset:   parseFloat(m[1]),
    lang:     langCode,
  }));
  return segmentsToSrt(segments);
}

async function fetchSrtMethod2(videoId, langCode) {
  const { YouTubeTranscriptApi, SRTFormatter } = await import("youtube-transcript-api-js");
  const api  = new YouTubeTranscriptApi();
  const list = await api.list(String(videoId));
  let transcript;
  try {
    transcript = list.findTranscript([langCode]);
  } catch {
    transcript = list.findTranscript(["en", "ar", "he", "fr", "es", "de", "ru", "zh", "ja"]);
  }
  if (transcript.languageCode !== langCode && transcript.isTranslatable
      && transcript.translationLanguagesDict?.has(langCode)) {
    transcript = transcript.translate(langCode);
  }
  const fetched = await transcript.fetch();
  return new SRTFormatter().formatTranscript(fetched);
}

// ── Method 3: parse ytInitialPlayerResponse from watch-page HTML ──────────────
// Completely different code path from methods 1 & 2 — no Innertube POST,
// no third-party library. Parses the JSON blob YouTube embeds in the page,
// downloads captions in json3 format, converts to SRT.

function extractJsonObject(html, marker) {
  const idx = html.indexOf(marker);
  if (idx === -1) return null;
  // Advance to the opening '{'
  let start = html.indexOf("{", idx + marker.length);
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (esc)           { esc = false; continue; }
    if (c === "\\" && inStr) { esc = true;  continue; }
    if (c === '"')     { inStr = !inStr; continue; }
    if (inStr)         { continue; }
    if (c === "{")     { depth++; }
    if (c === "}")     { depth--; if (depth === 0) return html.slice(start, i + 1); }
  }
  return null;
}

function json3ToSrt(data) {
  const events = (data.events || []).filter(e => e.segs?.length);
  if (!events.length) throw new Error("No caption events in json3 response");
  let idx = 1;
  const parts = [];
  for (const ev of events) {
    const text = ev.segs.map(s => s.utf8 || "").join("").trim();
    if (!text) continue;
    const start = ev.tStartMs || 0;
    const end   = start + (ev.dDurationMs || 3000);
    parts.push(`${idx}\n${msToSrtTime(start)} --> ${msToSrtTime(end)}\n${text}`);
    idx++;
  }
  if (!parts.length) throw new Error("All caption events were empty");
  return parts.join("\n\n");
}

async function fetchSrtMethod3(videoId, langCode) {
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  // Strategy: get caption track baseUrl, then download as json3 format.
  // Primary path — parse ytInitialPlayerResponse from the watch page HTML
  // (no Innertube POST request, same approach as tools like downsub.com).
  // Fallback — use ytPlayerData (IOS Innertube client) if the page is 429'd.
  let tracks = null;

  try {
    const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", "Accept": "text/html,application/xhtml+xml" },
    });
    if (!watchRes.ok) throw new Error(`Watch page HTTP ${watchRes.status}`);
    const html = await watchRes.text();

    const raw = extractJsonObject(html, "ytInitialPlayerResponse");
    if (!raw) throw new Error("ytInitialPlayerResponse not found");

    const playerResponse = JSON.parse(raw);
    const t = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (t?.length) tracks = t;
  } catch (_pageErr) {
    // Page fetch failed (e.g. 429 rate-limit on this IP) — fall back to
    // ytPlayerData which uses the IOS Innertube client (more bot-evasion).
  }

  if (!tracks) {
    // Watch page was rate-limited — call the Innertube player API directly
    // using a well-known public API key (no watch-page fetch required).
    const INNERTUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";
    const fallbackClients = [
      { clientName: "IOS",     clientVersion: "19.29.1",          deviceMake: "Apple", deviceModel: "iPhone16,2", osName: "iPhone", osVersion: "17.5.1" },
      { clientName: "TVHTML5", clientVersion: "7.20240724.13.00", hl: "en", gl: "US" },
      { clientName: "WEB",     clientVersion: "2.20240726.00.00", hl: "en", gl: "US" },
    ];
    for (const client of fallbackClients) {
      try {
        const res = await fetch(
          `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "User-Agent": UA,
                        "X-YouTube-Client-Name": client.clientName === "IOS" ? "5" : "1",
                        "X-YouTube-Client-Version": client.clientVersion },
            body: JSON.stringify({ context: { client }, videoId }),
          }
        );
        if (!res.ok) continue;
        const d = await res.json();
        const t = d?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (t?.length) { tracks = t; break; }
      } catch (_) { /* try next client */ }
    }
  }

  if (!tracks?.length) throw new Error("No caption tracks found (method 3)");

  // Pick the best matching language track
  const langBase = langCode.split("-")[0];
  const track =
    tracks.find(t => t.languageCode === langCode) ||
    tracks.find(t => t.languageCode.startsWith(langBase)) ||
    tracks.find(t => t.kind !== "asr") ||
    tracks[0];

  // Download as json3 (structured JSON — handles overlapping captions better than XML)
  const captionUrl = track.baseUrl.replace(/&fmt=[^&]*/g, "") + "&fmt=json3";
  const capRes = await fetch(captionUrl, { headers: { "User-Agent": UA } });
  if (!capRes.ok) throw new Error(`Caption download HTTP ${capRes.status}`);
  const data = await capRes.json();

  return json3ToSrt(data);
}

async function fetchSrt(videoId, langCode, method) {
  if (method === "1") return fetchSrtMethod1(videoId, langCode);
  if (method === "2") return fetchSrtMethod2(videoId, langCode);
  if (method === "3") return fetchSrtMethod3(videoId, langCode);
  let m1Error = null;
  try { return await fetchSrtMethod1(videoId, langCode); }
  catch (e1) { m1Error = e1.message; }
  try { return await fetchSrtMethod2(videoId, langCode); }
  catch (e2) {
    throw new Error(`Could not fetch transcript. m1: ${m1Error}. m2: ${e2.message}`);
  }
}

module.exports = { ytPlayerData, ytCaptionBaseUrl, fetchSrt, fetchSrtMethod1, fetchSrtMethod2, fetchSrtMethod3, segmentsToSrt };
