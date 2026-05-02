# my-app — Speech Translation App

## Overview
A React + TypeScript application for real-time speech recognition, translation, and text-to-speech. Built with Create React App (react-scripts 5).

## Features
- **Speech Recognition & Translation** (`/`) — Listen to speech and translate between languages using Web Speech API
- **YouTube Transcript Parser** (`/youtube`) — Parse and navigate YouTube video transcripts with timestamp sync
- **Proverbs** (`/proverb`) — Proverb display feature

## Architecture
- **Frontend:** React 18 + TypeScript, Create React App (react-scripts)
- **Routing:** react-router-dom v6
- **Speech:** react-speech-recognition, tts-react
- **No backend** — purely client-side SPA

## Project Structure
```
src/
  App.tsx              # Root router
  index.tsx            # React entry point
  components/          # UI components (Intro, YoutubeTranscriptNavigator, Proverbs, Footer, etc.)
  consts/              # Config constants and language maps
  hooks/               # Custom React hooks (voice, microphone, fullscreen, etc.)
  services/            # Utility services (mobile detection, recording)
  styles/              # CSS files
  types/               # TypeScript types
  utils/               # Utility functions (translation, TTS, YouTube parsing)
public/                # Static assets and fixtures
```

## Replit Setup
- **Port:** 5000 (HOST=0.0.0.0)
- **Workflow:** "Start application" runs `npm start`
- **Env:** `.env` sets `HOST=0.0.0.0`, `PORT=5000`, `DANGEROUSLY_DISABLE_HOST_CHECK=true`
- **Deployment:** Configured as static site (`npm run build` → `build/` dir)

## Running Locally
```bash
npm install --legacy-peer-deps
npm start
```

## Notes
- Microphone access required for speech features (browser permission needed)
- Uses browser's built-in Web Speech API — Chrome recommended
- `DANGEROUSLY_DISABLE_HOST_CHECK=true` is set to allow Replit's proxied preview iframe
