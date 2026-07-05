---
name: YouTube Learner routing
description: Which component actually renders at /youtube in this app, to avoid editing dead code.
---

The `/youtube` route (`App.tsx`) renders `YoutubeLearner/index.tsx`, which switches between
`SetupView.tsx` (URL entry + language selection) and `PlayerView.tsx` (playback + settings).

`YoutubeTranscriptNavigator/YoutubeTranscriptParser.tsx` (and its sibling `NewProjectWizard.tsx`)
looks like a plausible "main" YouTube transcript component (has similar debug-mode/localStorage
patterns, calls the same `/api/srt` endpoint) but is **not mounted in any route** — it's dead/orphaned
code from an earlier iteration.

**Why:** wasted a round-trip adding a UI feature only to `YoutubeTranscriptParser.tsx` and discovering
via screenshot that the live `/youtube` page didn't show it — the real UI lives in `SetupView.tsx` /
`PlayerView.tsx`.

**How to apply:** before adding UI to any YouTube-transcript-related component, grep `src/App.tsx` and
`YoutubeLearner/index.tsx` to confirm which component tree is actually routed, rather than assuming
based on filename/content similarity. If in doubt, screenshot the live route after the change.
