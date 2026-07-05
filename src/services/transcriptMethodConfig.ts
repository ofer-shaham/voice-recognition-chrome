// Configuration for which backend strategy is used to fetch YouTube subtitles.
//
// "validated" — the original (parent-commit) approach: fetches the transcript
//   using youtube-transcript-plus first, falling back to youtube-transcript-api-js,
//   both of which validate the requested language against the video's actual
//   caption-track list before downloading.
// "fast"       — the newer approach: parses ytInitialPlayerResponse (or falls
//   back to the Innertube player API) and grabs the closest-matching caption
//   track directly, without any language-list validation. Simpler and faster,
//   but does not validate that the requested language truly exists.
export type TranscriptMethod = "validated" | "fast";

const STORAGE_KEY = "yt_transcript_method";

// URL override: a boolean query param, e.g. `?fast=1` or `?fast=true` forces
// the "fast" (no-validation) method; `?fast=0`/`?fast=false` forces "validated".
// When present, it also persists to localStorage so the choice sticks across
// navigation (e.g. from Setup to Player).
const URL_PARAM = "fast";

function parseBooleanParam(raw: string | null): TranscriptMethod | null {
  if (raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return "fast";
  if (v === "0" || v === "false" || v === "no") return "validated";
  return null;
}

function getMethodFromUrl(): TranscriptMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return parseBooleanParam(params.get(URL_PARAM));
  } catch {
    return null;
  }
}

export function getTranscriptMethod(): TranscriptMethod {
  const fromUrl = getMethodFromUrl();
  if (fromUrl) {
    setTranscriptMethod(fromUrl);
    return fromUrl;
  }
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "validated" ? "validated" : "fast";
  } catch {
    return "fast";
  }
}

export function setTranscriptMethod(method: TranscriptMethod): void {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch {
    /* ignore storage failures */
  }
}

// Maps the UI-facing method to the backend's `method` query param.
// "validated" omits the param so the server uses its own method-1 -> method-2
// fallback chain; "fast" pins it to method 3 (ytInitialPlayerResponse + json3).
export function transcriptMethodQueryParam(): string {
  return getTranscriptMethod() === "fast" ? "&method=3" : "";
}
