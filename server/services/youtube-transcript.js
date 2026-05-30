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
    headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!watchPage.ok) throw new Error(`Watch page HTTP ${watchPage.status}`);
  const html = await watchPage.text();
  const keyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
                   html.match(/INNERTUBE_API_KEY\\":\\"([^\\"]+)\\"/);
  if (!keyMatch) throw new Error("Could not extract Innertube API key");
  const playerRes = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${keyMatch[1]}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
      body: JSON.stringify({
        context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
        videoId,
      }),
    }
  );
  if (!playerRes.ok) throw new Error(`Player API HTTP ${playerRes.status}`);
  return playerRes.json();
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

async function fetchSrt(videoId, langCode, method) {
  if (method === "1") return fetchSrtMethod1(videoId, langCode);
  if (method === "2") return fetchSrtMethod2(videoId, langCode);
  let m1Error = null;
  try { return await fetchSrtMethod1(videoId, langCode); }
  catch (e1) { m1Error = e1.message; }
  try { return await fetchSrtMethod2(videoId, langCode); }
  catch (e2) {
    throw new Error(`Could not fetch transcript. m1: ${m1Error}. m2: ${e2.message}`);
  }
}

module.exports = { ytPlayerData, ytCaptionBaseUrl, fetchSrt, fetchSrtMethod1, fetchSrtMethod2, segmentsToSrt };
