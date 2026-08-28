import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type PlaybackStatus = 'idle' | 'starting' | 'playing' | 'paused' | 'stopped' | 'ended' | 'error';
export type YoutubePlayerState = 'unknown' | 'unstarted' | 'playing' | 'paused' | 'buffering' | 'ended' | 'cued';

export interface YoutubePlaybackState {
  projectId: string | null;
  status: PlaybackStatus;
  youtubeState: YoutubePlayerState;
  currentLine: number;
  currentTime: number;
  duration: number;
  error: string | null;
  lastEvent: string;
}

const initialState: YoutubePlaybackState = {
  projectId: null,
  status: 'idle',
  youtubeState: 'unknown',
  currentLine: -1,
  currentTime: 0,
  duration: 0,
  error: null,
  lastEvent: 'initialized',
};

const playback = createSlice({
  name: 'youtubePlayback',
  initialState,
  reducers: {
    projectLoaded(state, action: PayloadAction<{ projectId: string; time?: number; line?: number }>) {
      state.projectId = action.payload.projectId;
      state.status = 'idle';
      state.youtubeState = 'unknown';
      state.currentTime = action.payload.time ?? 0;
      state.currentLine = action.payload.line ?? -1;
      state.error = null;
      state.lastEvent = 'projectLoaded';
    },
    playbackStarted(state, action: PayloadAction<{ line: number; reason?: string }>) {
      state.status = 'playing';
      state.currentLine = action.payload.line;
      state.error = null;
      state.lastEvent = action.payload.reason || 'playbackStarted';
    },
    playbackPaused(state) {
      state.status = 'paused';
      state.lastEvent = 'playbackPaused';
    },
    playbackStopped(state) {
      state.status = 'stopped';
      state.youtubeState = 'paused';
      state.lastEvent = 'playbackStopped';
    },
    playbackEnded(state) {
      state.status = 'ended';
      state.youtubeState = 'ended';
      state.lastEvent = 'playbackEnded';
    },
    playbackError(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
      state.lastEvent = 'playbackError';
    },
    currentLineChanged(state, action: PayloadAction<number>) {
      state.currentLine = action.payload;
      state.lastEvent = 'currentLineChanged';
    },
    playbackTimeUpdated(state, action: PayloadAction<number>) {
      state.currentTime = Math.max(0, action.payload);
    },
    youtubeStateChanged(state, action: PayloadAction<{ state: YoutubePlayerState; time?: number }>) {
      state.youtubeState = action.payload.state;
      if (typeof action.payload.time === 'number') {
        state.currentTime = Math.max(0, action.payload.time);
      }
      state.lastEvent = `youtube:${action.payload.state}`;
    },
    resetPlayback(state) {
      state.status = 'idle';
      state.youtubeState = 'unknown';
      state.currentLine = -1;
      state.currentTime = 0;
      state.duration = 0;
      state.error = null;
      state.lastEvent = 'resetPlayback';
    },
  },
});

export const {
  projectLoaded,
  playbackStarted,
  playbackPaused,
  playbackStopped,
  playbackEnded,
  playbackError,
  currentLineChanged,
  playbackTimeUpdated,
  youtubeStateChanged,
  resetPlayback,
} = playback.actions;

export default playback.reducer;