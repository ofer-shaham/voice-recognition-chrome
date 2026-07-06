const EXTERNAL_API_BASE = "https://youtube-dl-jrte.onrender.com";

export interface SubtitleInfo {
  code: string;
  name: string;
}

export interface VideoInfoResult {
  title: string;
  manualSubtitles: SubtitleInfo[];
  autoTranslatedSubtitles: SubtitleInfo[];
}

const buildVideoUrl = (videoId: string): string => {
  const trimmed = videoId.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.youtube.com/watch?v=${trimmed}`;
};

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}

export async function fetchVideoInfo(urlOrVideoId: string): Promise<VideoInfoResult> {
  const videoUrl = buildVideoUrl(urlOrVideoId);
  const apiUrl = `${EXTERNAL_API_BASE}/api/video-info?url=${encodeURIComponent(videoUrl)}`;

  const data = await fetchJson(apiUrl) as {
    title?: string;
    manualSubtitles?: Array<{ code: string; name?: string }>;
    autoTranslatedSubtitles?: Array<{ code: string; name?: string }>;
  };

  return {
    title: data.title || urlOrVideoId,
    manualSubtitles: (data.manualSubtitles || []).map(s => ({
      code: s.code,
      name: s.name || s.code,
    })),
    autoTranslatedSubtitles: (data.autoTranslatedSubtitles || []).map(s => ({
      code: s.code,
      name: s.name || s.code,
    })),
  };
}

export async function fetchSubtitlesSrt(urlOrVideoId: string, language: string): Promise<string> {
  const videoUrl = buildVideoUrl(urlOrVideoId);
  const apiUrl = `${EXTERNAL_API_BASE}/api/subtitles?url=${encodeURIComponent(videoUrl)}&type=srt&language=${encodeURIComponent(language)}&download=1`;
  return fetchText(apiUrl);
}

export async function fetchTranslatedTranscript(videoId: string, lang: string, targetLang?: string): Promise<string> {
  const langCode = String(lang || "en").split("-")[0];
  const target = targetLang || langCode;
  const apiUrl = `${EXTERNAL_API_BASE}/api/translate-transcript?videoID=${encodeURIComponent(videoId)}&language=${encodeURIComponent(langCode)}&targetLanguage=${encodeURIComponent(target)}&type=srt`;
  return fetchText(apiUrl);
}

export const youtubeApiBase = EXTERNAL_API_BASE;
