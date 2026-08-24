// The app now uses the translation API for transcript retrieval.
export type TranscriptMethod = "translation-api";

export function getTranscriptMethod(): TranscriptMethod {
  return "translation-api";
}

export function setTranscriptMethod(_method: TranscriptMethod): void {
  // Intentionally left empty. The supported method is fixed.
}

export function transcriptMethodQueryParam(): string {
  return "";
}
