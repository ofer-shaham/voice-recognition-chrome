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

export function getTranscriptMethod(): TranscriptMethod {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "fast" ? "fast" : "validated";
  } catch {
    return "validated";
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
