# `/youtube` App File Map

This document maps the source files that make up the YouTube language learner route. Generated files under `build/` are not included.

## Routes and Entry Points

| File | What it contains |
| --- | --- |
| [`src/App.tsx`](src/App.tsx) | Registers `/youtube` routes, redirects `/youtube` to `/youtube/setup`, and lazy-loads the learner. Also supports the parallel `/youtube2` route base. |
| [`src/index.tsx`](src/index.tsx) | React application entry point. |
| [`src/components/YoutubeLearner/index.tsx`](src/components/YoutubeLearner/index.tsx) | Main route coordinator. Resolves setup, project, view, history, lesson, and settings routes; restores shared URL state; selects the active project; and connects views to navigation. |
| [`src/components/YoutubeLearner/YoutubeLearner.css`](src/components/YoutubeLearner/YoutubeLearner.css) | Layout, themes, responsive behavior, player styles, settings styles, and footer-safe sizing for the learner. |

## Learner Views

| File | What it contains |
| --- | --- |
| [`src/components/YoutubeLearner/SetupView.tsx`](src/components/YoutubeLearner/SetupView.tsx) | Creates or imports a learner project, discovers subtitle tracks, handles YouTube and Invidious sources, and captures video metadata. |
| [`src/components/YoutubeLearner/PlayerView.tsx`](src/components/YoutubeLearner/PlayerView.tsx) | Main playback screen. Embeds YouTube, displays subtitle columns, synchronizes playback and URL state, handles translation, masking, sharing, TTS, and AI actions. |
| [`src/components/YoutubeLearner/LessonView.tsx`](src/components/YoutubeLearner/LessonView.tsx) | Displays the numbered lesson views reached through `/youtube/view/lesson/:id`. |
| [`src/components/YoutubeLearner/OpenRouterSettings.tsx`](src/components/YoutubeLearner/OpenRouterSettings.tsx) | Configures the OpenRouter key, model, and maximum token setting, including the connection test. |
| [`src/components/YoutubeLearner/types.ts`](src/components/YoutubeLearner/types.ts) | Type definitions for projects, subtitle providers, tracks, columns, themes, and learner configuration. |
| [`src/components/YoutubeLearner/constants.ts`](src/components/YoutubeLearner/constants.ts) | Shared learner defaults and constant values. |
| [`src/components/YoutubeLearner/utils.ts`](src/components/YoutubeLearner/utils.ts) | Small learner-specific parsing, formatting, and URL utilities. |
| [`src/components/YoutubeLearner/useVoices.ts`](src/components/YoutubeLearner/useVoices.ts) | Discovers and exposes browser speech-synthesis voices for TTS. |

## State, Persistence, and Transfer

| File | What it contains |
| --- | --- |
| [`src/components/YoutubeLearner/useProject.ts`](src/components/YoutubeLearner/useProject.ts) | Project CRUD and localStorage persistence for learner projects and the last active project. |
| [`src/components/YoutubeLearner/projectTransfer.ts`](src/components/YoutubeLearner/projectTransfer.ts) | Project export/import helpers for moving learner projects between browsers or sessions. |
| [`src/store/`](src/store/) | Shared Redux store and slices used by playback and application state. The learner reads and updates this state through its playback-related components. |

## Lessons, Translation, and AI

| File | What it contains |
| --- | --- |
| [`src/components/YoutubeLearner/lesson.ts`](src/components/YoutubeLearner/lesson.ts) | Builds lesson prompts, selects validated AI keys, generates masks locally or with OpenRouter, and applies token limits and response validation. |
| [`src/services/openRouterService.ts`](src/services/openRouterService.ts) | Browser-side OpenRouter client. Stores key/model/token settings, validates keys, and sends chat requests to the local API proxy. |
| [`src/utils/translate.tsx`](src/utils/translate.tsx) | Translation adapters and language translation requests used by subtitle columns. |
| [`src/config/aiConfig.json`](src/config/aiConfig.json) | Central AI configuration used by the application. |
| [`src/components/YoutubeLearner/lesson.test.ts`](src/components/YoutubeLearner/lesson.test.ts) | Unit tests for lesson prompts, mask generation, token behavior, and response handling. |

## Subtitle and Provider Services

| File | What it contains |
| --- | --- |
| [`src/services/youtubeTranscriptService.ts`](src/services/youtubeTranscriptService.ts) | Client-side transcript metadata and translated-transcript requests. |
| [`server/services/youtube-transcript.js`](server/services/youtube-transcript.js) | Server-side transcript language discovery and SRT retrieval, including YouTube, Invidious, proxy, and fallback handling. |
| [`server/services/youtube-service-config.js`](server/services/youtube-service-config.js) | Transcript provider definitions, alternatives, retry behavior, proxy settings, and UI service configuration. |
| [`server/services/proxy-manager.js`](server/services/proxy-manager.js) | Reads and rotates configured HTTP proxy values for transcript requests. |
| [`server/services/youtube-transcript.test.js`](server/services/youtube-transcript.test.js) | Server tests for transcript and Invidious caption URL behavior. |

## Backend and Deployment APIs

| File | What it contains |
| --- | --- |
| [`server/index.js`](server/index.js) | Express API for transcript endpoints, Invidious captions, TTS, OpenRouter chat, key health checks, free models, and API documentation. |
| [`server/package.json`](server/package.json) | Server dependencies and scripts for transcript providers. |
| [`server/README.md`](server/README.md) | Local server setup and transcript API documentation. |
| [`netlify/functions/api.js`](netlify/functions/api.js) | Netlify serverless equivalents of the API routes used in deployed builds. |
| [`src/setupProxy.js`](src/setupProxy.js) | Development proxy configuration for browser requests to local API endpoints. |

## Tests and Fixtures

| File | What it covers |
| --- | --- |
| [`src/components/YoutubeLearner/PlayerView.test.tsx`](src/components/YoutubeLearner/PlayerView.test.tsx) | Player rendering and playback-related component behavior. |
| [`src/App.test.tsx`](src/App.test.tsx) | Application-level rendering and route integration checks. |
| [`cypress/e2e/invidious.cy.ts`](cypress/e2e/invidious.cy.ts) | Invidious subtitle import and playback with caption fixtures. |
| [`cypress/e2e/youtube_translation_languages.cy.ts`](cypress/e2e/youtube_translation_languages.cy.ts) | Shared translation settings, language columns, persistence, and translation cancellation. |
| [`cypress/e2e/youtube_playback_diagnostics.cy.ts`](cypress/e2e/youtube_playback_diagnostics.cy.ts) | Shared playback URLs, hydration, subtitle state, and playback diagnostics. |
| [`cypress/e2e/title.cy.tsx`](cypress/e2e/title.cy.tsx) | Route-level translation request routing and learner page visibility. |
| [`cypress/e2e/debug_mode.cy.js`](cypress/e2e/debug_mode.cy.js) | Debug panel behavior while using the application, including learner-related diagnostics. |
| [`public/fixtures/`](public/fixtures/) | Static subtitle and proverb fixtures available to browser tests and local runs. |
| [`build/fixtures/`](build/fixtures/) | Build-time copies of static fixtures; generated and not a source of truth. |

## High-Level Request Flow

1. `src/App.tsx` matches `/youtube/*` and mounts `YoutubeLearner`.
2. `YoutubeLearner/index.tsx` resolves the URL, restores or selects a local project, and renders the appropriate view.
3. `SetupView.tsx` discovers subtitle metadata through `youtubeTranscriptService.ts` or the API provider endpoints.
4. `PlayerView.tsx` loads the selected video and subtitle tracks, then coordinates playback, translations, masks, TTS, and sharing.
5. Translation and AI requests pass through `src/utils/translate.tsx` or `openRouterService.ts` to the Express or Netlify API.
6. Project configuration and shared URL history persist in browser localStorage; focused unit and Cypress tests exercise the main flows.
