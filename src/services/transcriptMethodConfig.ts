import appConfig from '../config/appConfig.json';

// "validated" — fetch via youtube-transcript-plus → youtube-transcript-api-js fallback chain (methods 1+2)
// "fast"      — parse ytInitialPlayerResponse from watch-page HTML (method 3)
// "downsub"   — DownSub-hosted API at youtube-dl-jrte.onrender.com (method 4, default)
export type TranscriptMethod = "validated" | "fast" | "downsub";

const STORAGE_KEY = "yt_transcript_method";
const URL_PARAM   = "method";

function getMethodFromUrl(): TranscriptMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const v = new URLSearchParams(window.location.search).get(URL_PARAM);
    if (v === "validated" || v === "fast" || v === "downsub") return v;
  } catch { /* ignore */ }
  return null;
}

export function getTranscriptMethod(): TranscriptMethod {
  const fromUrl = getMethodFromUrl();
  if (fromUrl) {
    setTranscriptMethod(fromUrl);
    return fromUrl;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "validated" || v === "fast" || v === "downsub") return v;
  } catch { /* ignore */ }
  return (appConfig.youtube.transcriptMethod as TranscriptMethod) ?? "downsub";
}

export function setTranscriptMethod(method: TranscriptMethod): void {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch { /* ignore */ }
}

// Maps the UI method to the backend `method` query param.
export function transcriptMethodQueryParam(): string {
  const m = getTranscriptMethod();
  if (m === "fast")     return "&method=3";
  if (m === "downsub")  return "&method=4";
  return ""; // "validated" — server runs its own 1→2 fallback chain
}
