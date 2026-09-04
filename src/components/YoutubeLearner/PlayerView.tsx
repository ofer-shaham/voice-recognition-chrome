import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  YtProject,
  YtTrack,
  ParsedLine,
  ProjectConfig,
  ColSetting,
  AvailableLang,
  YoutubeTheme,
  SUBTITLE_SERVICE_INFO,
} from './types';
import { buildLines, parseSrt, secondsToHms, colLabel, sleep, dedupeAvailLangs } from './utils';
import { DEFAULT_TTS_RATE } from './constants';
import { translate, getTranslationCacheCount } from '../../utils/translate';
import { generateDifficultyMask, usesLocalDifficultyMask } from './lesson';
import { getStoredOpenRouterApiKey } from '../../services/openRouterService';
import { freeSpeak } from '../../utils/freeSpeak';
import isRtl from '../../utils/isRtl';
import { useVoices } from './useVoices';
import { downloadProject } from './projectTransfer';
import type { AppDispatch, RootState } from '../../store';
import {
  currentLineChanged,
  playbackEnded,
  playbackPaused,
  playbackStarted,
  playbackStopped,
  playbackTimeUpdated,
  projectLoaded,
  youtubeStateChanged,
} from '../../store/youtubePlaybackSlice';

// Wake Lock for background playback on mobile
let wakeLock: any = null;
const requestWakeLock = async () => {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await (navigator as any).wakeLock.request('screen');
    } catch { /* ignore */ }
  }
};
const releaseWakeLock = async () => {
  if (wakeLock) {
    try { await wakeLock.release(); } catch { /* ignore */ }
    wakeLock = null;
  }
};
// Re-acquire wake lock on visibility change
if (typeof document !== 'undefined' && 'wakeLock' in navigator) {
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && wakeLock === null) {
      await requestWakeLock();
    }
  });
}

// Media Session API for background playback
if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => { });
  navigator.mediaSession.setActionHandler('pause', () => { });
  navigator.mediaSession.setActionHandler('nexttrack', () => { });
  navigator.mediaSession.setActionHandler('previoustrack', () => { });
}

interface Props {
  routeBase?: '/youtube' | '/youtube2';
  project: YtProject;
  onSave: (p: YtProject) => void;
  onBackHome: () => void;
  onBackToView?: () => void;
  onNewVideo: () => void;
  onDelete: (id: string) => void;
  projects: YtProject[];
  onSelectProject: (p: YtProject) => void;
  theme: YoutubeTheme;
  onThemeChange: (theme: YoutubeTheme) => void;
  initialShowSettings?: boolean;
  settingsOnly?: boolean;
}

// Encode colId for URL: track:en → en, translation → t
const shortCol = (id: string) => id === 'translation' ? 't' : id.replace('track:', '');
const translationCol = (lang: string) => `translation:${lang}`;
const isTranslationCol = (id: string) => id === 'translation' || id.startsWith('translation:');
const translationLang = (id: string, config: ProjectConfig) => {
  if (id === 'translation') return config.targetLang;
  const language = id.slice('translation:'.length);
  return ['auto', 'default', 'und'].includes(language.toLowerCase()) ? config.targetLang : language;
};
const TRANSLATION_AHEAD = 7;

const normalizeConfig = (source: ProjectConfig): ProjectConfig => {
  const targets = source.translationTargets?.length
    ? source.translationTargets
    : source.colOrder.includes('translation') && source.targetLang.trim() ? [source.targetLang.trim()] : [];
  const legacyTranslation = source.colOrder.includes('translation');
  const colOrder = source.colOrder.map(id => legacyTranslation && id === 'translation' ? translationCol(targets[0]) : id);
  const colSettings = { ...source.colSettings };
  if (legacyTranslation && targets[0] && colSettings.translation && !colSettings[translationCol(targets[0])]) {
    colSettings[translationCol(targets[0])] = colSettings.translation;
  }
  delete colSettings.translation;
  return { ...source, targetLang: targets[0] || source.targetLang || '', translationTargets: targets, colOrder, colSettings };
};

const hydrateConfigFromUrl = (source: ProjectConfig): ProjectConfig => {
  if (typeof window === 'undefined') return source;
  const params = new URLSearchParams(window.location.search);
  const urlTarget = params.get('tl')?.trim() || '';
  const urlTranslationTargets = Array.from(params.keys())
    .map(key => key.match(/^(?:r|vn)_translation:(.+)$/)?.[1]?.trim())
    .filter((lang): lang is string => !!lang);
  const inferredTargets = Array.from(new Set([urlTarget, ...urlTranslationTargets].filter(Boolean)));
  if (!inferredTargets.length && !source.translationTargets?.length) return source;

  const targets = Array.from(new Set([...(source.translationTargets || []), ...inferredTargets]));
  const translationIds = targets.map(translationCol);
  const colOrder = [...source.colOrder.filter(colId => !translationIds.includes(colId) && colId !== 'video'), ...translationIds, ...(source.colOrder.includes('video') ? ['video'] : [])];
  const colSettings = { ...source.colSettings };
  const basePlayOrder = source.colOrder.filter(colId => !isTranslationCol(colId) && colId !== 'video').length;
  for (const [index, target] of targets.entries()) {
    const id = translationCol(target);
    const rate = Number(params.get(`r_translation:${target}`));
    colSettings[id] = {
      ...(colSettings[id] || {}),
      visible: colSettings[id]?.visible !== false,
      playOrder: basePlayOrder + index + 1,
      ttsRate: Number.isFinite(rate) && rate > 0 ? rate : colSettings[id]?.ttsRate || DEFAULT_TTS_RATE,
      voiceName: params.get(`vn_translation:${target}`) || colSettings[id]?.voiceName,
    };
  }

  for (const id of Object.keys(colSettings)) {
    const sid = shortCol(id);
    const rate = Number(params.get(`r_${sid}`));
    const voiceName = params.get(`vn_${sid}`);
    if (Number.isFinite(rate) && rate > 0 || voiceName) {
      colSettings[id] = {
        ...colSettings[id],
        ...(Number.isFinite(rate) && rate > 0 ? { ttsRate: rate } : {}),
        ...(voiceName ? { voiceName } : {}),
      };
    }
  }

  return {
    ...source,
    targetLang: urlTarget || targets[0] || source.targetLang,
    translationTargets: targets,
    colOrder,
    colSettings,
  };
};

export default function PlayerView({ routeBase = '/youtube', project, onSave, onBackHome, onBackToView, onNewVideo, onDelete, projects, onSelectProject, theme, onThemeChange, initialShowSettings = false, settingsOnly = false }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const playback = useSelector((state: RootState) => state.youtubePlayback);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const defaultVisibleLines = () => {
    const params = new URLSearchParams(window.location.search);
    const urlVl = parseInt(params.get('vl') || '', 10);
    if (!isNaN(urlVl) && urlVl >= 3) return urlVl;
    return isMobile ? 3 : 30; // Mobile: 1 before + current + 1 after
  };

  const [lines, setLines] = useState<ParsedLine[]>([]);
  const [config, setConfig] = useState<ProjectConfig>(() => {
    const base = normalizeConfig(project.config);
    return hydrateConfigFromUrl({ ...base, visibleLines: defaultVisibleLines() });
  });
  const isPlaying = playback.status === 'playing' || playback.status === 'starting';
  const currentLine = playback.currentLine;
  const playbackTime = playback.currentTime;
  const [windowStart, setWindowStart] = useState(0);
  const [iframeSeg, setIframeSeg] = useState({ startSec: 0, endSec: 0 });
  const [iframeKey, setIframeKey] = useState(0);
  const [playerReady, setPlayerReady] = useState(false);
  const [showSettings, setShowSettings] = useState(initialShowSettings);

  useEffect(() => {
    const currentConfig = normalizeConfig(project.config);
    const hydrated = hydrateConfigFromUrl({ ...currentConfig, visibleLines: currentConfig.visibleLines || defaultVisibleLines() });
    const isHydrated = hydrated.targetLang !== currentConfig.targetLang
      || (hydrated.translationTargets || []).join(',') !== (currentConfig.translationTargets || []).join(',')
      || hydrated.colOrder.join(',') !== currentConfig.colOrder.join(',');

    if (isHydrated) {
      const savedProject = { ...project, config: hydrated, updatedAt: Date.now() };
      onSave(savedProject);
    }
  }, [onSave, project]);
  const [translationVer, setTranslationVer] = useState(0);
  const [currentWord, setCurrentWord] = useState<{ lineIdx: number; colId: string; charIndex: number; charLength: number } | null>(null);
  // Keep one persistent iframe so row playback can seek without reloading.
  const seamlessMode = true;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showManageLangs, setShowManageLangs] = useState(false);
  const [availLangs, setAvailLangs] = useState<AvailableLang[]>([]);
  const [langsLoading, setLangsLoading] = useState(false);
  const [langsError, setLangsError] = useState('');
  const [addingLang, setAddingLang] = useState<string | null>(null);
  const [cachedCount, setCachedCount] = useState(() => getTranslationCacheCount());
  const [translatingIndices, setTranslatingIndices] = useState<Set<number>>(new Set());
  const [translationStatus, setTranslationStatus] = useState<'idle' | 'translating' | 'ready' | 'rate-limited'>('idle');
  const [translationStatusMessage, setTranslationStatusMessage] = useState('');
  const [aiTranslationLevel, setAiTranslationLevel] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    // Check URL parameter first (for shared links)
    const urlMask = new URLSearchParams(window.location.search).get('mask');
    if (urlMask) {
      const raw = Number(urlMask);
      return Number.isFinite(raw) ? Math.min(5, Math.max(0, Math.round(raw))) : 3;
    }
    // Fall back to localStorage
    const raw = Number(window.localStorage.getItem('yt_ai_level') || '3');
    return Number.isFinite(raw) ? Math.min(5, Math.max(0, Math.round(raw))) : 3;
  });
  const [useMaskAsTranslationBase, setUseMaskAsTranslationBase] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Check URL parameter first (for shared links)
    const urlUseMask = new URLSearchParams(window.location.search).get('useMask');
    if (urlUseMask === 'true') return true;
    // Fall back to localStorage
    const raw = window.localStorage.getItem('yt_use_mask_base');
    return raw === 'true';
  });
  const [aiTranslationMode, setAiTranslationMode] = useState<'full' | 'rows'>(() => {
    if (typeof window === 'undefined') return 'rows';
    const raw = window.localStorage.getItem('yt_ai_mode');
    return raw === 'full' || raw === 'rows' ? raw : 'rows';
  });
  const [aiTranslationRows, setAiTranslationRows] = useState<number>(() => {
    if (typeof window === 'undefined') return 12;
    const raw = Number(window.localStorage.getItem('yt_ai_rows') || '12');
    return Number.isFinite(raw) ? Math.max(1, Math.round(raw)) : 12;
  });
  const [aiMaskRows, setAiMaskRows] = useState<Record<number, string>>({});
  const [aiMaskLoading, setAiMaskLoading] = useState(false);
  const [aiMaskError, setAiMaskError] = useState('');
  const [newTranslationLang, setNewTranslationLang] = useState('');
  const [alternateYoutubeUrl, setAlternateYoutubeUrl] = useState(project.alternateYoutubeUrl || '');
  const [subtitleProxyUrl, setSubtitleProxyUrl] = useState(project.subtitleProxyUrl || '');
  const [proxyMode, setProxyMode] = useState<'direct' | 'http' | 'tor'>(project.subtitleProxyUrl ? 'http' : 'direct');
  const subtitleService = project.subtitleService || 'plus';
  const subtitleServiceInfo = SUBTITLE_SERVICE_INFO[subtitleService];

  const { langOptions, voicesForLang } = useVoices();

  const cancelRef = useRef(false);
  const linesRef = useRef<ParsedLine[]>([]);
  const configRef = useRef<ProjectConfig>(project.config);
  const projectRef = useRef<YtProject>(project);
  const pendingSet = useRef<Set<number>>(new Set());
  const translatingSet = useRef<Set<number>>(new Set());
  const rowRefs = useRef<Record<number, HTMLTableRowElement | null>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);  // seamless visible iframe
  const audioRef = useRef<HTMLIFrameElement>(null);  // always-present background audio iframe
  const seamlessRef = useRef(false);
  const showVideoRef = useRef(true);
  const audioOnlyRef = useRef(false);
  const isPlayingRef = useRef(false);
  const currentLineRef = useRef(-1);
  const initialSeekRef = useRef<number | null>(null);
  const playbackSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPlayback = useRef({ time: project.lastTime ?? 0, line: project.lastLine ?? 0 });
  const playbackRunRef = useRef(0);
  const playbackTimeRef = useRef(project.lastTime ?? 0);
  const playerReadyRef = useRef(false);
  const seamlessVideoStartedRef = useRef(false);
  const autoStartedProjectRef = useRef<string | null>(null);
  const suppressPlayerEventsUntilRef = useRef(0);

  useEffect(() => { setShowSettings(initialShowSettings); }, [initialShowSettings]);
  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => {
    setAlternateYoutubeUrl(project.alternateYoutubeUrl || '');
    setSubtitleProxyUrl(project.subtitleProxyUrl || '');
    setProxyMode(project.subtitleProxyUrl ? 'http' : 'direct');
  }, [project.id]);
  useEffect(() => { seamlessRef.current = true; }, []);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentLineRef.current = currentLine; }, [currentLine]);
  useEffect(() => { playbackTimeRef.current = playbackTime; }, [playbackTime]);

  const savePlaybackPosition = useCallback((time: number, line: number) => {
    pendingPlayback.current = { time, line };
    if (playbackSaveTimer.current !== null) return;
    playbackSaveTimer.current = setTimeout(() => {
      playbackSaveTimer.current = null;
      const latest = pendingPlayback.current;
      onSave({ ...projectRef.current, lastLine: Math.max(0, latest.line), lastTime: Math.max(0, latest.time), updatedAt: Date.now() });
    }, 750);
  }, [onSave]);

  const flushPlaybackPosition = useCallback(() => {
    if (playbackSaveTimer.current !== null) {
      clearTimeout(playbackSaveTimer.current);
      playbackSaveTimer.current = null;
    }
    onSave({
      ...projectRef.current,
      lastLine: Math.max(0, currentLineRef.current),
      lastTime: Math.max(0, pendingPlayback.current.time || playbackTime),
      updatedAt: Date.now(),
    });
  }, [onSave, playbackTime]);

  // ── Derived: video visible? audio-only mode? ─────────────────────────────────
  const showVideo = config.colSettings['video']?.visible && !!project.videoId;
  const audioOnlyMode = !showVideo && !!project.videoId;
  const remotePlayerTarget = showVideo ? iframeRef : audioRef;
  const totalDuration = lines.length > 0 ? lines[lines.length - 1].endSec : 0;
  const currentTimeSec = playbackTime > 0
    ? playbackTime
    : (currentLine >= 0 ? (lines[currentLine]?.startSec ?? 0) : 0);

  useEffect(() => { showVideoRef.current = showVideo; }, [showVideo]);
  useEffect(() => { audioOnlyRef.current = audioOnlyMode; }, [audioOnlyMode]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('yt_ai_level', String(aiTranslationLevel));
      window.localStorage.setItem('yt_ai_mode', aiTranslationMode);
      window.localStorage.setItem('yt_ai_rows', String(aiTranslationRows));
      window.localStorage.setItem('yt_use_mask_base', String(useMaskAsTranslationBase));
    }
  }, [aiTranslationLevel, aiTranslationMode, aiTranslationRows, useMaskAsTranslationBase]);

  // ── When mask base is toggled, invalidate translation cache ────────────────
  useEffect(() => {
    // Mark all lines as pending re-translation when switching between mask/original base
    pendingSet.current = new Set(linesRef.current.map((_, i) => i));
    // Clear cached translations so they get re-fetched with the new source
    setLines(prev => prev.map(line => ({
      ...line,
      translation: '',
      translated: false,
      translations: {},
      translatedTargets: {}
    })));
    setTranslationVer(v => v + 1);
  }, [useMaskAsTranslationBase]);

  // ── URL sync: reflect project + config in address bar ───────────────────────
  useEffect(() => {
    // Position is deliberately committed only when playback is not active.
    // Rebuilding the URL every media tick causes needless history/route churn.
    if (isPlaying) return;
    const p = new URLSearchParams();
    if (project.videoId) p.set('v', project.videoId);
    else p.set('p', project.id);
    p.set('m', project.subtitleService || 'plus');
    p.set('tl', config.targetLang);
    p.set('l', String(project.lastLine));
    p.set('t', String(Math.floor(playbackTimeRef.current)));
    p.set('vl', String(config.visibleLines));
    if (project.alternateYoutubeUrl) p.set('instanceUrl', project.alternateYoutubeUrl);
    if (project.subtitleProxyUrl) p.set('proxyUrl', project.subtitleProxyUrl);
    for (const [colId, s] of Object.entries(config.colSettings)) {
      if (colId === 'video') continue;
      const sid = shortCol(colId);
      if (s.ttsRate !== DEFAULT_TTS_RATE) p.set(`r_${sid}`, s.ttsRate.toFixed(1));
      if (s.voiceName) p.set(`vn_${sid}`, s.voiceName);
    }
    // Include AI mask settings in URL
    if (aiTranslationLevel > 0) p.set('mask', String(aiTranslationLevel));
    if (useMaskAsTranslationBase) p.set('useMask', 'true');
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [project.id, project.videoId, project.lastLine, config, isPlaying, seamlessMode, aiTranslationLevel, useMaskAsTranslationBase]);

  // ── Parse SRT on project change ─────────────────────────────────────────────
  useEffect(() => {
    if (!project.tracks.length) return;
    const [primary, ...rest] = project.tracks;
    const primaryColId = `track:${primary.lang}`;
    const parsed = buildLines(
      primaryColId,
      parseSrt(primary.srtContent),
      rest.map(t => ({ colId: `track:${t.lang}`, segs: parseSrt(t.srtContent) }))
    );
    pendingSet.current = new Set(parsed.map((_, i) => i));
    setLines(parsed);
    // Preserve visibleLines from URL/initial state
    const params = new URLSearchParams(window.location.search);
    const urlVl = parseInt(params.get('vl') || '', 10);
    const visibleLines = !isNaN(urlVl) && urlVl >= 3 ? urlVl : configRef.current.visibleLines;
    const hydratedConfig = hydrateConfigFromUrl({ ...normalizeConfig(project.config), visibleLines });
    configRef.current = hydratedConfig;
    setConfig(hydratedConfig);
    // Read line number from URL if present
    const urlLine = parseInt(params.get('l') || '', 10);
    const startLine = !isNaN(urlLine) && urlLine >= 0 && urlLine < parsed.length ? urlLine : project.lastLine;
    const urlTime = parseFloat(params.get('t') || '');
    const initialTime = !isNaN(urlTime) && urlTime >= 0
      ? urlTime
      : (project.lastTime ?? parsed[startLine]?.startSec ?? 0);
    initialSeekRef.current = initialTime;
    dispatch(projectLoaded({ projectId: project.id, time: initialTime, line: startLine }));
    setWindowStart(Math.max(0, startLine - 3));
    setTranslationVer(v => v + 1);
    setPlayerReady(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, dispatch]);

  // ── Auto-generate mask on page load if difficulty is set ────────────────────
  useEffect(() => {
    if (aiTranslationLevel === 0) return; // "None" is selected
    if (lines.length === 0) return; // Wait for lines

    // Check if masks for current visible window already exist
    const firstVisibleIndex = windowStart;
    const lastVisibleIndex = Math.min(windowStart + config.visibleLines - 1, lines.length - 1);
    const allMasksExist = Array.from({ length: lastVisibleIndex - firstVisibleIndex + 1 }).every((_, i) =>
      aiMaskRows[firstVisibleIndex + i] !== undefined
    );
    if (allMasksExist) return; // Masks for current window already exist

    const autoGenerate = async () => {
      setAiMaskLoading(true);
      try {
        const rows = await generateDifficultyMask(project, aiTranslationLevel, config.visibleLines, true, windowStart);
        // Accumulate masks instead of replacing - allows scrolling to generate more masks
        setAiMaskRows(prev => ({
          ...prev,
          ...Object.fromEntries(rows.map((text, index) => [windowStart + index, text]))
        }));
      } catch {
        // Silently fail - user can manually generate if needed
      } finally {
        setAiMaskLoading(false);
      }
    };

    autoGenerate();
  }, [project.id, aiTranslationLevel, lines.length, windowStart, config.visibleLines]);

  useEffect(() => {
    if (!useMaskAsTranslationBase) return;
    const maskIndices = Object.keys(aiMaskRows).map(Number).filter(Number.isFinite);
    if (!maskIndices.length) return;

    pendingSet.current = new Set([...pendingSet.current, ...maskIndices]);
    setLines(prev => prev.map((line, index) => maskIndices.includes(index) ? {
      ...line,
      translation: '',
      translated: false,
      translations: {},
      translatedTargets: {},
    } : line));
    setTranslationVer(version => version + 1);
  }, [aiMaskRows, useMaskAsTranslationBase]);

  // ── On-demand translation ─────────────────────────────────────────────────────
  // Translate only what the learner can see, plus a small lookahead. This keeps
  // navigation responsive without sending the whole transcript to the API.
  useEffect(() => {
    // EARLY GUARD: If using mask as translation base but masks aren't ready yet, skip entire translation
    if (useMaskAsTranslationBase && Object.keys(aiMaskRows).length === 0) {
      setTranslationStatus('idle');
      setTranslationStatusMessage('Generating AI mask for translation...');
      return;
    }

    let cancelled = false;
    const run = async () => {
      if (lines.length === 0) return; // Wait for lines to be populated
      const targets = (configRef.current.translationTargets || []).filter(Boolean);
      if (!targets.length) {
        pendingSet.current.clear();
        translatingSet.current.clear();
        setTranslatingIndices(new Set());
        setTranslationStatus('idle');
        setTranslationStatusMessage('Choose a target language to translate');
        setLines(prev => prev.map(line => ({ ...line, translation: '', translated: true, translations: {}, translatedTargets: {} })));
        return;
      }
      const rangeEnd = Math.min(lines.length, windowStart + configRef.current.visibleLines + TRANSLATION_AHEAD);
      const indices = Array.from(pendingSet.current)
        .filter(i => i >= windowStart && i < rangeEnd)
        .sort((a, b) => a - b);
      if (!indices.length) {
        setTranslationStatus('ready');
        setTranslationStatusMessage(`Visible lines are translated${TRANSLATION_AHEAD ? ` · ${TRANSLATION_AHEAD} ahead` : ''}`);
        return;
      }
      setTranslationStatus('translating');
      setTranslationStatusMessage(`Translating visible lines + ${TRANSLATION_AHEAD} ahead`);
      let wasRateLimited = false;
      for (const i of indices) {
        if (cancelled) break;
        const line = linesRef.current[i];
        if (!line) { pendingSet.current.delete(i); continue; }
        const cfg = configRef.current;
        // Use mask as translation base if enabled and available
        const srcText = (useMaskAsTranslationBase && aiMaskRows[i])
          ? aiMaskRows[i]
          : (line.texts[cfg.translationSource] || '');
        if (!srcText.trim()) {
          pendingSet.current.delete(i);
          setLines(prev => prev.map((l, idx) => idx === i ? { ...l, translation: '', translated: true, translations: {}, translatedTargets: Object.fromEntries(targets.map(target => [target, true])) } : l));
          continue;
        }
        translatingSet.current.add(i);
        setTranslatingIndices(new Set(translatingSet.current));
        const fromLang = cfg.translationSource.replace('track:', '').split('-')[0];
        for (const target of targets) {
          if (line.translatedTargets?.[target]) continue;
          try {
            const result = await translate({ finalTranscriptProxy: srcText, fromLang, toLang: target });
            if (result === 'translation error') throw new Error('translation error');
            setLines(prev => prev.map((l, idx) => idx === i ? {
              ...l,
              translation: target === cfg.targetLang ? result : l.translation,
              translated: target === cfg.targetLang,
              translations: { ...(l.translations || {}), [target]: result },
              translatedTargets: { ...(l.translatedTargets || {}), [target]: true },
            } : l));
            setCachedCount(getTranslationCacheCount());
          } catch {
            wasRateLimited = true;
            setTranslationStatus('rate-limited');
            setTranslationStatusMessage('Translation unavailable · retrying when you navigate');
            break;
          }
        }
        if (targets.every(target => line.translatedTargets?.[target])) pendingSet.current.delete(i);
        translatingSet.current.delete(i);
        setTranslatingIndices(new Set(translatingSet.current));
        if (wasRateLimited) break;
        // Space requests out to avoid bursting a rate-limited provider.
        await sleep(250);
      }
      if (!cancelled && !wasRateLimited) {
        setTranslationStatus('ready');
        setTranslationStatusMessage(`Visible lines are translated · ${TRANSLATION_AHEAD} ahead`);
      }
    };
    run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationVer, lines.length, windowStart, config.visibleLines, aiTranslationLevel, aiTranslationMode, aiTranslationRows, useMaskAsTranslationBase, aiMaskLoading]);

  // ── Slide window to follow current line ─────────────────────────────────────
  useEffect(() => {
    if (currentLine < 0) return;
    const mid = Math.floor(config.visibleLines / 2);
    setWindowStart(prev => {
      const ideal = Math.max(0, Math.min(lines.length - config.visibleLines, currentLine - mid));
      return ideal !== prev ? ideal : prev;
    });
  }, [currentLine, config.visibleLines, lines.length]);

  // ── Auto-scroll active row ───────────────────────────────────────────────────
  useEffect(() => {
    if (currentLine >= 0) rowRefs.current[currentLine]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentLine]);

  // ── Config helpers ───────────────────────────────────────────────────────────
  const stopMedia = useCallback(() => {
    playbackRunRef.current += 1;
    cancelRef.current = true;
    seamlessVideoStartedRef.current = false;
    suppressPlayerEventsUntilRef.current = Date.now() + 1000;
    speechSynthesis.cancel();
    for (const ref of [iframeRef, audioRef]) {
      try {
        ref.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
          '*'
        );
      } catch { /* ignore cross-origin errors */ }
    }
    releaseWakeLock();
    isPlayingRef.current = false;
  }, []);

  const stop = useCallback(() => {
    stopMedia();
    flushPlaybackPosition();
    dispatch(playbackStopped());
    dispatch(currentLineChanged(-1));
  }, [dispatch, flushPlaybackPosition, stopMedia]);

  const stopPlaybackForSettingsChange = useCallback(() => {
    if (isPlayingRef.current || playback.status === 'playing' || playback.status === 'starting') {
      stop();
    }
  }, [playback.status, stop]);

  const updateConfig = useCallback((patch: Partial<ProjectConfig>) => {
    if (patch.targetLang !== undefined || patch.translationSource !== undefined || patch.translationTargets !== undefined) {
      stopPlaybackForSettingsChange();
    }
    const next = { ...configRef.current, ...patch };
    configRef.current = next;
    setConfig(next);
    onSave({ ...projectRef.current, config: next, updatedAt: Date.now() });
  }, [onSave, stopPlaybackForSettingsChange]);

  const updateColSetting = useCallback((colId: string, patch: Partial<ColSetting>) => {
    const next = {
      ...configRef.current,
      colSettings: {
        ...configRef.current.colSettings,
        [colId]: { ...configRef.current.colSettings[colId], ...patch },
      },
    };
    configRef.current = next;
    setConfig(next);
    onSave({ ...projectRef.current, config: next, updatedAt: Date.now() });
  }, [onSave]);

  useEffect(() => {
    if (!voicesForLang || !project.config.colSettings || !Object.keys(project.config.colSettings).length) return;
    const nextColSettings = { ...configRef.current.colSettings };
    let changed = false;
    for (const colId of configRef.current.colOrder) {
      if (colId === 'video' || nextColSettings[colId]?.voiceName) continue;
      const language = isTranslationCol(colId)
        ? translationLang(colId, configRef.current)
        : colId.replace('track:', '');
      const defaultVoice = voicesForLang(language)[0];
      if (!defaultVoice) continue;
      nextColSettings[colId] = { ...nextColSettings[colId], voiceName: defaultVoice.name };
      changed = true;
    }
    if (!changed) return;
    const nextConfig = { ...configRef.current, colSettings: nextColSettings };
    configRef.current = nextConfig;
    setConfig(nextConfig);
    onSave({ ...projectRef.current, config: nextConfig, updatedAt: Date.now() });
  }, [onSave, project.config.colSettings, voicesForLang]);

  const updateProjectSource = useCallback((patch: Pick<YtProject, 'alternateYoutubeUrl' | 'subtitleProxyUrl'>) => {
    const next = { ...projectRef.current, ...patch, updatedAt: Date.now() };
    projectRef.current = next;
    onSave(next);
  }, [onSave]);

  const retranslate = useCallback(() => {
    setLines(prev => {
      pendingSet.current = new Set(prev.map((_, i) => i));
      return prev.map(l => ({ ...l, translation: '', translated: false, translations: {}, translatedTargets: {} }));
    });
    setTranslationStatus('idle');
    setTranslationStatusMessage('Translation queued for the visible window');
    setTranslationVer(v => v + 1);
  }, []);

  const rebuildLines = useCallback((tracks: YtTrack[], cfg: ProjectConfig) => {
    if (!tracks.length) return;
    const [primary, ...rest] = tracks;
    const primaryColId = `track:${primary.lang}`;
    const parsed = buildLines(
      primaryColId,
      parseSrt(primary.srtContent),
      rest.map(t => ({ colId: `track:${t.lang}`, segs: parseSrt(t.srtContent) }))
    );
    pendingSet.current = new Set(parsed.map((_, i) => i));
    setLines(parsed);
    // Preserve visibleLines from current config
    setConfig(prev => ({ ...cfg, visibleLines: prev.visibleLines }));
    setTranslationVer(v => v + 1);
  }, []);

  const fetchAvailLangs = useCallback(async () => {
    if (!projectRef.current.videoId) return;
    setLangsLoading(true);
    setLangsError('');
    try {
      const query = new URLSearchParams({ videoId: projectRef.current.videoId });
      const service = projectRef.current.subtitleService || 'plus';
      const serviceInfo = SUBTITLE_SERVICE_INFO[service];
      if (serviceInfo.supportsAlternate && projectRef.current.alternateYoutubeUrl) {
        query.set('instanceUrl', projectRef.current.alternateYoutubeUrl);
      }
      if (serviceInfo.supportsProxy && projectRef.current.subtitleProxyUrl) {
        query.set('proxyUrl', projectRef.current.subtitleProxyUrl);
      }
      if (service === 'onrender') query.set('service', 'onrender');
      else if (service !== 'iframe') {
        query.set('method', service === 'api-js' ? '2' : '1');
      }
      const res = await fetch(`/api/transcript/languages?${query.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const data = await res.json();
      setAvailLangs(dedupeAvailLangs((data.availableLanguages || []).map((l: any) => ({
        languageCode: l.languageCode || String(l),
        name: l.name || l.languageCode || String(l),
        isAutoGenerated: !!l.isAutoGenerated,
      }))));
    } catch (e: any) {
      setLangsError(e.message || 'Failed to fetch languages');
    }
    setLangsLoading(false);
  }, []);

  const addLangTrack = useCallback(async (lang: AvailableLang) => {
    const langCode = lang.languageCode.split('-')[0];
    setAddingLang(lang.languageCode);
    setLangsError('');
    try {
      const serviceMethod = projectRef.current.subtitleService === 'api-js'
        ? '2'
        : projectRef.current.subtitleService === 'onrender' ? '3' : '1';
      const service = projectRef.current.subtitleService || 'plus';
      const serviceInfo = SUBTITLE_SERVICE_INFO[service];
      const query = new URLSearchParams({
        videoId: projectRef.current.videoId,
        lang: langCode,
        method: serviceMethod,
      });
      if (serviceInfo.supportsAlternate && projectRef.current.alternateYoutubeUrl) {
        query.set('instanceUrl', projectRef.current.alternateYoutubeUrl);
      }
      if (serviceInfo.supportsProxy && projectRef.current.subtitleProxyUrl) {
        query.set('proxyUrl', projectRef.current.subtitleProxyUrl);
      }
      const res = await fetch(`/api/srt?${query.toString()}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const srtContent = await res.text();
      const newTrack: YtTrack = { lang: lang.languageCode, label: lang.name, isAuto: lang.isAutoGenerated, srtContent };
      const p = projectRef.current;
      const newTracks = [...p.tracks, newTrack];
      const colId = `track:${lang.languageCode}`;
      const newColOrder = [
        ...p.config.colOrder.filter(id => id !== 'video'),
        colId,
        ...(p.config.colOrder.includes('video') ? ['video'] : []),
      ];
      const newColSettings = {
        ...p.config.colSettings,
        [colId]: { visible: true, playOrder: newTracks.length, ttsRate: DEFAULT_TTS_RATE },
      };
      const newConfig = { ...p.config, colOrder: newColOrder, colSettings: newColSettings };
      const updatedProject = { ...p, tracks: newTracks, config: newConfig, updatedAt: Date.now() };
      projectRef.current = updatedProject;
      onSave(updatedProject);
      rebuildLines(newTracks, newConfig);
    } catch (e: any) {
      setLangsError(`Failed to add ${lang.name}: ${(e as any).message}`);
    }
    setAddingLang(null);
  }, [onSave, rebuildLines]);

  const removeLangTrack = useCallback((trackLang: string) => {
    const p = projectRef.current;
    if (p.tracks.length <= 1) return;
    const newTracks = p.tracks.filter(t => t.lang !== trackLang);
    const colId = `track:${trackLang}`;
    const newColOrder = p.config.colOrder.filter(id => id !== colId);
    const newColSettings = { ...p.config.colSettings };
    delete newColSettings[colId];
    let newTranslationSource = p.config.translationSource;
    if (newTranslationSource === colId) newTranslationSource = `track:${newTracks[0].lang}`;
    const newConfig = { ...p.config, colOrder: newColOrder, colSettings: newColSettings, translationSource: newTranslationSource };
    const updatedProject = { ...p, tracks: newTracks, config: newConfig, updatedAt: Date.now() };
    onSave(updatedProject);
    rebuildLines(newTracks, newConfig);
  }, [onSave, rebuildLines]);

  const toggleTranslation = useCallback((language = configRef.current.targetLang.trim()) => {
    const nextLanguage = language.trim();
    if (!nextLanguage) return;

    stopPlaybackForSettingsChange();

    const p = projectRef.current;
    const currentConfig = configRef.current;
    const id = translationCol(nextLanguage);
    const targets = Array.from(new Set([...(currentConfig.translationTargets || p.config.translationTargets || []), nextLanguage]));
    const colOrder = currentConfig.colOrder.includes(id)
      ? currentConfig.colOrder
      : [...currentConfig.colOrder.filter(colId => colId !== 'video'), id, ...(currentConfig.colOrder.includes('video') ? ['video'] : [])];
    const colSettings = { ...currentConfig.colSettings };
    if (!colSettings[id]) {
      colSettings[id] = {
        visible: true,
        playOrder: currentConfig.colOrder.filter(colId => !isTranslationCol(colId) && colId !== 'video').length + targets.length,
        ttsRate: 0.9,
      };
    }
    const updatedConfig = {
      ...currentConfig,
      targetLang: nextLanguage,
      translationTargets: targets,
      colOrder,
      colSettings,
    };
    configRef.current = updatedConfig;
    setConfig(updatedConfig);
    onSave({ ...p, config: updatedConfig, updatedAt: Date.now() });
    retranslate();
  }, [onSave, retranslate, stopPlaybackForSettingsChange]);

  const removeTranslation = useCallback((language: string) => {
    stopPlaybackForSettingsChange();
    const p = projectRef.current;
    const currentConfig = configRef.current;
    const id = translationCol(language);
    const targets = (currentConfig.translationTargets || p.config.translationTargets || []).filter(target => target !== language);
    const colSettings = { ...currentConfig.colSettings };
    delete colSettings[id];
    const updatedConfig = {
      ...currentConfig,
      targetLang: targets.includes(currentConfig.targetLang) ? currentConfig.targetLang : targets[0] || '',
      translationTargets: targets,
      colOrder: currentConfig.colOrder.filter(colId => colId !== id),
      colSettings,
    };
    configRef.current = updatedConfig;
    setConfig(updatedConfig);
    onSave({ ...p, config: updatedConfig, updatedAt: Date.now() });
    retranslate();
  }, [onSave, retranslate, stopPlaybackForSettingsChange]);

  const saveProviderSettings = useCallback((patch: Pick<YtProject, 'alternateYoutubeUrl' | 'subtitleProxyUrl'>) => {
    onSave({ ...projectRef.current, ...patch, updatedAt: Date.now() });
  }, [onSave]);

  // ── YouTube postMessage control ──────────────────────────────────────────────
  // Routes to: visible seamless iframe (iframeRef) when seamless+video, else background audio iframe (audioRef)
  const ytCmd = useCallback((func: string, args: any[] = []) => {
    try {
      const target = (seamlessRef.current && showVideoRef.current) ? iframeRef : audioRef;
      if (target === iframeRef) {
        audioRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
      } else {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
      }
      target.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch { /* ignore cross-origin errors */ }
  }, []);

  // Ask an embedded YouTube iframe to start streaming playback state (infoDelivery events)
  const startListening = useCallback((ref: React.RefObject<HTMLIFrameElement>) => {
    try {
      ref.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'listening', id: 'yl-sync' }),
        '*'
      );
      ref.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
        '*'
      );
      if (initialSeekRef.current !== null) {
        ref.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [initialSeekRef.current, true] }),
          '*'
        );
        initialSeekRef.current = null;
      }
      playerReadyRef.current = true;
      setPlayerReady(true);
    } catch { /* ignore cross-origin errors */ }
  }, []);

  const waitForVideoTime = useCallback((targetSec: number, fallbackMs: number) => new Promise<void>(resolve => {
    const startedAt = Date.now();
    const check = () => {
      if (cancelRef.current || playbackTimeRef.current >= targetSec || Date.now() - startedAt >= fallbackMs) {
        resolve();
        return;
      }
      window.setTimeout(check, 50);
    };
    check();
  }), []);

  useEffect(() => () => {
    stopMedia();
    dispatch(playbackStopped());
  }, [dispatch, stopMedia]);

  // ── Sync row to native iframe interaction only ───────────────────────────────
  // Row selection is the source of truth for playback (row → seekTo). This only
  // reacts when the user directly presses play or drags the seek bar on the
  // embedded YouTube player itself — i.e. while our own row-driven playback loop
  // (isPlaying) is NOT running, so it never fights with row → video sync.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const sourceWindow = event.source;
      if (
        sourceWindow &&
        sourceWindow !== iframeRef.current?.contentWindow &&
        sourceWindow !== audioRef.current?.contentWindow
      ) return;
      if (typeof event.data !== 'string') return;
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data?.event !== 'infoDelivery' || !data.info) return;
      const playerState = data.info.playerState;
      const youtubeState = playerState === 1
        ? 'playing'
        : playerState === 2
          ? 'paused'
          : playerState === 3
            ? 'buffering'
            : playerState === 0
              ? 'ended'
              : playerState === 5
                ? 'cued'
                : playerState === -1
                  ? 'unstarted'
                  : 'unknown';
      const t = typeof data.info.currentTime === 'number' ? data.info.currentTime : undefined;
      dispatch(youtubeStateChanged({ state: youtubeState, time: t }));

      if (!isPlayingRef.current && typeof playerState === 'number') {
        if (Date.now() >= suppressPlayerEventsUntilRef.current && playerState === 1) {
          dispatch(playbackStarted({ line: currentLineRef.current >= 0 ? currentLineRef.current : 0, reason: 'youtube:play' }));
        } else if (Date.now() >= suppressPlayerEventsUntilRef.current && playerState === 2) {
          dispatch(playbackPaused());
        } else if (Date.now() >= suppressPlayerEventsUntilRef.current && playerState === 0) {
          dispatch(playbackEnded());
        }
      }
      if (typeof t !== 'number') return;
      dispatch(playbackTimeUpdated(t));
      const ls = linesRef.current;
      if (!ls.length) return;
      let idx = -1;
      for (let i = 0; i < ls.length; i++) {
        if (t >= ls[i].startSec && (i === ls.length - 1 || t < ls[i + 1].startSec)) { idx = i; break; }
      }
      if (idx === -1) idx = t <= ls[0].startSec ? 0 : ls.length - 1;
      if (idx !== currentLineRef.current) {
        currentLineRef.current = idx;
        dispatch(currentLineChanged(idx));
      }
      savePlaybackPosition(t, idx);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [dispatch, savePlaybackPosition]);

  // ── Playback ─────────────────────────────────────────────────────────────────
  const playLine = useCallback(async (lineIdx: number) => {
    const line = linesRef.current[lineIdx];
    const cfg = configRef.current;
    if (!line) return;

    const isSeamless = seamlessRef.current;

    const playable = cfg.colOrder
      .filter(id => cfg.colSettings[id]?.visible && !cfg.colSettings[id]?.muted && (cfg.colSettings[id]?.playOrder ?? 0) > 0)
      .sort((a, b) => (cfg.colSettings[a]?.playOrder ?? 0) - (cfg.colSettings[b]?.playOrder ?? 0));

    for (const colId of playable) {
      if (cancelRef.current) return;
      const s = cfg.colSettings[colId];

      if (colId === 'video') {
        if (isSeamless || audioOnlyRef.current) {
          // The persistent iframe must keep playing across subtitle boundaries.
          // Cue changes are tracked from YouTube's currentTime events instead
          // of pausing at each next subtitle start.
          if (!seamlessVideoStartedRef.current) {
            seamlessVideoStartedRef.current = true;
            playbackTimeRef.current = line.startSec;
            ytCmd('seekTo', [line.startSec, true]);
            await sleep(200);
            ytCmd('playVideo');
          }
          const durationMs = Math.max(500, (line.endSec - line.startSec) * 1000);
          await waitForVideoTime(line.endSec, durationMs + 2000);
        } else {
          // Classic mode: re-key the iframe to play just this segment
          setIframeSeg({ startSec: line.startSec, endSec: line.endSec });
          setIframeKey(k => k + 1);
          await sleep(Math.max(1000, (line.endSec - line.startSec) * 1000 + 800));
        }
      } else {
        const text = isTranslationCol(colId)
          ? (linesRef.current[lineIdx]?.translations?.[translationLang(colId, cfg)] || '')
          : (line.texts[colId] || '');
        const lang = isTranslationCol(colId)
          ? translationLang(colId, cfg)
          : colId.replace('track:', '');
        const shouldReadAloud = (s?.playOrder ?? 0) > 0;
        if (text.trim() && shouldReadAloud) {
          setCurrentWord(null); // Reset before new speech
          try {
            await freeSpeak(
              text,
              lang,
              s?.ttsRate ?? DEFAULT_TTS_RATE,
              s?.voiceName || undefined,
              (charIndex, charLength) => setCurrentWord({ lineIdx, colId, charIndex, charLength })
            );
          } catch { /* ignore */ }
          setCurrentWord(null);
        }
      }
      if (cancelRef.current) return;
    }
  }, [waitForVideoTime, ytCmd]);

  const pausePlayback = useCallback(() => {
    stopMedia();
    dispatch(playbackPaused());
    const line = currentLineRef.current;
    if (line >= 0) {
      onSave({ ...projectRef.current, lastLine: line, lastTime: playbackTime, updatedAt: Date.now() });
    }
  }, [dispatch, onSave, playbackTime, stopMedia]);

  const playFrom = useCallback(async (startIdx: number) => {
    const runId = playbackRunRef.current + 1;
    playbackRunRef.current = runId;
    // Ensure video is paused before starting new playback
    ytCmd('pauseVideo');
    seamlessVideoStartedRef.current = false;
    cancelRef.current = false;
    isPlayingRef.current = true;
    dispatch(playbackStarted({ line: startIdx, reason: 'sequence:start' }));
    await requestWakeLock();
    for (let i = startIdx; i < linesRef.current.length; i++) {
      if (cancelRef.current || playbackRunRef.current !== runId) break;
      dispatch(currentLineChanged(i));
      dispatch(playbackTimeUpdated(linesRef.current[i]?.startSec ?? 0));
      onSave({ ...projectRef.current, lastLine: i, lastTime: linesRef.current[i]?.startSec ?? 0, updatedAt: Date.now() });
      await playLine(i);
    }
    if (!cancelRef.current && playbackRunRef.current === runId) {
      suppressPlayerEventsUntilRef.current = Date.now() + 1000;
      ytCmd('pauseVideo');
      seamlessVideoStartedRef.current = false;
      releaseWakeLock();
      isPlayingRef.current = false;
      dispatch(playbackEnded());
      dispatch(currentLineChanged(-1));
    }
  }, [dispatch, playLine, onSave, ytCmd]);

  // Reset the active row back to the very first line
  const resetToStart = useCallback(() => {
    if (isPlaying) stop();
    ytCmd('seekTo', [0, true]);
    dispatch(currentLineChanged(-1));
    setWindowStart(0);
    onSave({ ...projectRef.current, lastLine: 0, updatedAt: Date.now() });
  }, [dispatch, isPlaying, stop, ytCmd, onSave]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const visibleCols = useMemo(
    () => config.colOrder.filter(id => id !== 'video' && config.colSettings[id]?.visible),
    [config.colOrder, config.colSettings]
  );
  const visibleRows = lines.slice(windowStart, windowStart + config.visibleLines);
  const maskVisible = Object.keys(aiMaskRows).length > 0;
  const displayCols = maskVisible
    ? [
      ...visibleCols.filter(id => !isTranslationCol(id)),  // Primary language columns
      'ai-mask',
      ...visibleCols.filter(id => isTranslationCol(id))    // Translation columns
    ]
    : visibleCols;

  // Helper to render text with word highlighting
  const renderHighlightedText = (text: string, lineIdx: number, colId: string) => {
    // Get mask words for this line (only for original language, not translations)
    const maskText = !isTranslationCol(colId) ? aiMaskRows[lineIdx] : null;
    const maskWords = maskText ?
      new Set(maskText.toLowerCase().split(/\s+/).filter(w => w.length > 0)) :
      new Set<string>();

    // If current word is selected, highlight it (takes precedence over mask highlighting)
    if (currentWord && currentWord.lineIdx === lineIdx && currentWord.colId === colId) {
      const { charIndex, charLength } = currentWord;
      const before = text.slice(0, charIndex);
      const word = text.slice(charIndex, charIndex + (charLength || text.length - charIndex));
      const after = text.slice(charIndex + (charLength || text.length - charIndex));
      return (
        <>
          {before}
          <span className="yl-word-highlight">{word}</span>
          {after}
        </>
      );
    }

    // If no current word but mask words exist, highlight mask words in original text
    if (maskWords.size > 0) {
      const parts = text.split(/(\s+)/);
      return (
        <>
          {parts.map((part, idx) => {
            const isWhitespace = /^\s+$/.test(part);
            const isMaskWord = maskWords.has(part.toLowerCase());
            return isWhitespace ? part : (
              isMaskWord ? (
                <span key={idx} className="yl-mask-word-highlight">{part}</span>
              ) : (
                <span key={idx}>{part}</span>
              )
            );
          })}
        </>
      );
    }

    return text;
  };

  // Classic mode iframe URL (segment-specific, re-keyed)
  const classicIframeUrl = `https://www.youtube-nocookie.com/embed/${project.videoId}` +
    `?start=${Math.floor(iframeSeg.startSec)}&end=${Math.ceil(iframeSeg.endSec)}` +
    `&autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

  // Seamless mode iframe URL (full video, persistent, JS API enabled)
  const seamlessIframeUrl = `https://www.youtube-nocookie.com/embed/${project.videoId}` +
    `?enablejsapi=1&rel=0&modestbranding=1&autoplay=0&playsinline=1`;

  const handleRowClick = (lineIdx: number) => {
    if (isPlaying) { pausePlayback(); setTimeout(() => playFrom(lineIdx), 150); }
    else { playFrom(lineIdx); }
  };

  const toggleVideo = () => {
    updateColSetting('video', { visible: !config.colSettings['video']?.visible });
  };

  const handleAudioSeek = (sec: number) => {
    ytCmd('seekTo', [sec, true]);
    if (lines.length === 0) return;
    const idx = lines.reduce((best, line, i) =>
      Math.abs(line.startSec - sec) < Math.abs(lines[best].startSec - sec) ? i : best, 0);
    if (isPlaying) { stop(); setTimeout(() => playFrom(idx), 150); }
    else {
      currentLineRef.current = idx;
      dispatch(currentLineChanged(idx));
    }
  };

  const generateMask = async () => {
    setAiMaskLoading(true);
    setAiMaskError('');
    try {
      // Generate masks for all visible rows, not just aiTranslationRows (12)
      const rows = await generateDifficultyMask(project, aiTranslationLevel, config.visibleLines, true, windowStart);
      setAiMaskRows(Object.fromEntries(rows.map((text, index) => [windowStart + index, text])));
    } catch (error) {
      setAiMaskError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiMaskLoading(false);
    }
  };

  // ── SRT download ─────────────────────────────────────────────────────────────
  const [showDownload, setShowDownload] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const downloadSrt = useCallback((track: { label: string; srtContent: string }) => {
    const safe = (project.title + '-' + track.label).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
    const blob = new Blob([track.srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  }, [project.title]);

  if (settingsOnly) {
    return (
      <div className={`yl-player yl-theme-${theme}`}>
        <div className="yl-header">
          <div className="yl-header-left">
            <button className="yl-btn-ghost" onClick={() => { stopMedia(); if (onBackToView) { onBackToView(); } else { onBackHome(); } }}>← View</button>
            <button className="yl-btn-ghost" onClick={() => { stopMedia(); onBackHome(); }}>← Home</button>
            <button className="yl-btn-ghost" onClick={() => { stopMedia(); onNewVideo(); }}>＋ New</button>
            <label className="yl-theme-control">
              <span className="yl-sr-only">Theme</span>
              <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
                <option value="light">Light</option>
                <option value="blue">Blue</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <span className="yl-video-title" title={project.title}>{project.title}</span>
          </div>
        </div>

        {showSettings && lines.length > 0 && (
          <div className="yl-settings">
            <div className="yl-settings-heading">
              <div>
                <strong>Project settings</strong>
                <span>Choose what is shown and how captions are read.</span>
              </div>
              <button className="yl-btn-ghost yl-btn-sm" onClick={() => setShowSettings(false)}>Close</button>
            </div>
            <div className="yl-settings-global">
              <label className="yl-setting-field yl-translation-setting">
                <span>Add language</span>
                <div className="yl-translation-setting-control">
                  <input
                    className="yl-input-sm yl-target-input"
                    type="text"
                    list="yl-settings-lang-suggestions"
                    value={newTranslationLang}
                    onChange={e => setNewTranslationLang(e.target.value)}
                    aria-label="New translation language"
                    placeholder="ar, ru, he…"
                  />
                  <button
                    className="yl-btn-secondary yl-btn-sm"
                    type="button"
                    onClick={() => {
                      const next = newTranslationLang.trim();
                      if (!next) return;
                      toggleTranslation(next);
                      setNewTranslationLang('');
                    }}
                  >
                    Add language
                  </button>
                  <datalist id="yl-settings-lang-suggestions">
                    {langOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </datalist>
                </div>
              </label>
              <label className="yl-setting-field">
                <span>Source column</span>
                <select className="yl-select-sm" value={config.translationSource}
                  onChange={e => { updateConfig({ translationSource: e.target.value }); retranslate(); }}>
                  {config.colOrder.filter(id => id.startsWith('track:')).map(id => (
                    <option key={id} value={id}>{colLabel(id, project)}</option>
                  ))}
                </select>
              </label>
              <label className="yl-setting-field">
                <span>Visible lines</span>
                <input type="number" className="yl-input-sm" min={3} max={500}
                  value={config.visibleLines}
                  onChange={e => updateConfig({ visibleLines: Math.max(3, parseInt(e.target.value) || 30) })}
                />
              </label>
              <div className="yl-setting-field">
                <span>Cached translations</span>
                <span className="yl-setting-info">{cachedCount} line{cachedCount === 1 ? '' : 's'}</span>
              </div>
            </div>

            <div className="yl-settings-cols">
              {config.colOrder.map(colId => {
                const s = config.colSettings[colId];
                if (!s) return null;
                return (
                  <div key={colId} data-col-id={colId} className={`yl-col-card ${s.visible ? '' : 'yl-col-card-hidden'}`}>
                    <div className="yl-col-card-header">
                      <span className="yl-col-card-name">{colLabel(colId, project)}</span>
                      {isTranslationCol(colId) && (
                        <button className="yl-btn-ghost yl-btn-sm" type="button"
                          onClick={() => removeTranslation(translationLang(colId, config))}
                          title="Remove translation">Remove</button>
                      )}
                      <label className="yl-toggle">
                        <input type="checkbox" checked={s.visible}
                          onChange={e => updateColSetting(colId, { visible: e.target.checked })} />
                        <span className="yl-toggle-track" />
                      </label>
                    </div>
                    <div className="yl-col-card-body">
                      <label className="yl-setting-field">
                        <span title="Play order (0 = skip)">Order</span>
                        <input type="number" className="yl-input-sm" min={0} max={10}
                          value={s.playOrder}
                          onChange={e => updateColSetting(colId, { playOrder: Math.max(0, parseInt(e.target.value) || 0) })}
                        />
                      </label>
                      {colId !== 'video' && (
                        <label className="yl-setting-field">
                          <span>Mute</span>
                          <input type="checkbox" checked={s.muted === true}
                            onChange={e => updateColSetting(colId, { muted: e.target.checked })} />
                        </label>
                      )}
                      {colId !== 'video' && (() => {
                        const colLang = isTranslationCol(colId)
                          ? translationLang(colId, config)
                          : colId.replace('track:', '');
                        const colVoices = voicesForLang(colLang);
                        return (
                          <>
                            <label className="yl-setting-field">
                              <span>Speed {s.ttsRate.toFixed(1)}×</span>
                              <input type="range" min={0.5} max={2} step={0.1}
                                value={s.ttsRate}
                                onChange={e => updateColSetting(colId, { ttsRate: parseFloat(e.target.value) })}
                              />
                            </label>
                            {colVoices.length > 0 && (
                              <label className="yl-setting-field yl-voice-field">
                                <span>Voice</span>
                                <select
                                  className="yl-select-sm yl-voice-select"
                                  value={s.voiceName ?? ''}
                                  onChange={e => updateColSetting(colId, { voiceName: e.target.value || undefined })}
                                >
                                  <option value="">Auto</option>
                                  {colVoices.map(v => (
                                    <option key={v.name} value={v.name}>
                                      {v.name}{v.localService ? '' : ' ☁'}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {project.videoId && (
              <div className="yl-manage-langs">
                <button
                  className={`yl-btn-ghost yl-btn-sm ${showManageLangs ? 'yl-active' : ''}`}
                  onClick={() => {
                    if (!showManageLangs && availLangs.length === 0) fetchAvailLangs();
                    setShowManageLangs(s => !s);
                    setLangsError('');
                  }}
                >
                  🌐 Manage languages
                </button>

                {showManageLangs && (
                  <div className="yl-manage-langs-panel">
                    <div className="yl-manage-langs-section">
                      <span className="yl-manage-langs-label">Loaded tracks</span>
                      <div className="yl-lang-chips">
                        {project.tracks.map(t => (
                          <span key={t.lang} className="yl-lang-chip yl-lang-chip-loaded">
                            <span>{t.label || t.lang}</span>
                            {project.tracks.length > 1 && (
                              <button
                                className="yl-lang-chip-remove"
                                title={`Remove ${t.label}`}
                                onClick={() => removeLangTrack(t.lang)}
                              >✕</button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="yl-manage-langs-section">
                      <span className="yl-manage-langs-label">
                        Add a subtitle
                        <button
                          className="yl-btn-ghost yl-btn-sm"
                          style={{ marginLeft: '0.4rem' }}
                          onClick={fetchAvailLangs}
                          disabled={langsLoading}
                          title="Refresh subtitle list"
                        >
                          {langsLoading ? '…' : '↺'}
                        </button>
                      </span>
                      {langsError && <p className="yl-error" style={{ margin: '0.2rem 0 0' }}>{langsError}</p>}
                      {langsLoading ? (
                        <span className="yl-manage-langs-hint">Fetching available languages…</span>
                      ) : (() => {
                        const unloaded = availLangs.filter(l =>
                          !project.tracks.some(t =>
                            t.lang === l.languageCode ||
                            t.lang.split('-')[0] === l.languageCode.split('-')[0]
                          )
                        );
                        if (availLangs.length > 0 && unloaded.length === 0) {
                          return <span className="yl-manage-langs-hint">All available languages are loaded.</span>;
                        }
                        return (
                          <div className="yl-lang-chips">
                            {unloaded.map(l => (
                              <button
                                key={l.languageCode}
                                className="yl-lang-chip yl-lang-chip-add"
                                disabled={addingLang !== null}
                                onClick={() => addLangTrack(l)}
                              >
                                {addingLang === l.languageCode ? '…' : '+'} {l.name}
                                {l.isAutoGenerated && <span className="yl-auto-badge">auto</span>}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`yl-player yl-theme-${theme}`}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="yl-header">
        <div className="yl-header-left">
          <button className="yl-btn-ghost" onClick={() => { stopMedia(); onBackHome(); }}>← Home</button>
          <button className="yl-btn-ghost" onClick={() => { stopMedia(); onNewVideo(); }}>＋ New</button>
          <label className="yl-theme-control">
            <span className="yl-sr-only">Theme</span>
            <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
              <option value="light">Light</option>
              <option value="blue">Blue</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          {projects.length > 1 && (
            <select className="yl-select-sm" value={project.id}
              onChange={e => { const p = projects.find(x => x.id === e.target.value); if (p) { setConfirmDelete(false); onSelectProject(p); } }}>
              {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          )}
          <span className="yl-video-title" title={project.title}>{project.title}</span>

          {/* ── Delete project ── */}
          {confirmDelete ? (
            <span className="yl-delete-confirm">
              Delete?
              <button className="yl-btn-ghost yl-btn-sm yl-btn-danger"
                onClick={() => { setConfirmDelete(false); if (isPlaying) stop(); onDelete(project.id); }}>
                Yes
              </button>
              <button className="yl-btn-ghost yl-btn-sm" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </span>
          ) : (
            <button className="yl-btn-ghost yl-btn-sm yl-btn-danger" title="Delete this project"
              onClick={() => setConfirmDelete(true)}>
              🗑
            </button>
          )}
        </div>
        <div className="yl-header-right">
          <span className="yl-line-info">
            {isPlaying ? `▶ ${currentLine + 1}/${lines.length}` : `${lines.length} lines`}
          </span>

          {lines.length > 0 && (
            <>
              {/* ── Download SRT ── */}
              <div className="yl-download-wrap">
                {project.tracks.length === 1 ? (
                  <button
                    className="yl-btn-ghost"
                    title="Download SRT"
                    onClick={() => downloadSrt(project.tracks[0])}
                  >
                    ⬇ SRT
                  </button>
                ) : (
                  <>
                    <button
                      className={`yl-btn-ghost ${showDownload ? 'yl-active' : ''}`}
                      title="Download SRT"
                      onClick={() => setShowDownload(s => !s)}
                    >
                      ⬇ SRT
                    </button>
                    {showDownload && (
                      <div className="yl-download-menu">
                        {project.tracks.map(t => (
                          <button
                            key={t.lang}
                            className="yl-download-item"
                            onClick={() => downloadSrt(t)}
                          >
                            {t.label || t.lang}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <button className="yl-btn-ghost" title="Export project" onClick={() => downloadProject(project)}>
                ⤓ Project
              </button>

              {project.videoId && (
                <button
                  className={`yl-btn-ghost ${showVideo ? 'yl-active' : ''}`}
                  onClick={toggleVideo}
                  title={showVideo ? 'Hide video' : 'Show video'}
                >
                  {showVideo ? '📺 Hide' : '📺 Video'}
                </button>
              )}
              <button
                className="yl-btn-ghost"
                title="Reset to the first line"
                onClick={resetToStart}
              >
                ⟲ Reset
              </button>
              <button
                className={`yl-btn-play ${isPlaying ? 'yl-btn-stop' : ''}`}
                onClick={() => isPlaying
                  ? pausePlayback()
                  : playFrom(Math.max(0, currentLine >= 0 ? currentLine : project.lastLine))}
              >
                {isPlaying ? '⏸ Pause' : (currentLine >= 0 || project.lastLine > 0 ? '▶ Resume' : '▶ Play')}
              </button>
              <button
                className={`yl-btn-ghost ${shareCopied ? 'yl-btn-share-copied' : ''}`}
                title="Share this position and settings"
                onClick={async () => {
                  const p = new URLSearchParams();
                  if (project.videoId) p.set('v', project.videoId);
                  else p.set('p', project.id);
                  p.set('m', project.subtitleService || 'plus');
                  if (project.subtitleUrl) p.set('url', project.subtitleUrl);
                  const openRouterKey = getStoredOpenRouterApiKey();
                  if (openRouterKey) p.set('orKey', openRouterKey);
                  if (project.alternateYoutubeUrl) p.set('instanceUrl', project.alternateYoutubeUrl);
                  if (project.subtitleProxyUrl) p.set('proxyUrl', project.subtitleProxyUrl);
                  p.set('tl', config.targetLang);
                  p.set('l', String(currentLine >= 0 ? currentLine : project.lastLine));
                  p.set('t', String(Math.floor(currentLine >= 0 ? currentTimeSec : (lines[project.lastLine]?.startSec ?? 0))));
                  for (const [colId, s] of Object.entries(config.colSettings)) {
                    if (colId === 'video') continue;
                    const sid = shortCol(colId);
                    if (s.ttsRate !== DEFAULT_TTS_RATE) p.set(`r_${sid}`, s.ttsRate.toFixed(1));
                    if (s.voiceName) p.set(`vn_${sid}`, s.voiceName);
                  }
                  // Include AI mask settings
                  if (aiTranslationLevel > 0) p.set('mask', String(aiTranslationLevel));
                  if (useMaskAsTranslationBase) p.set('useMask', 'true');
                  const sharePath = `${routeBase}/project/${encodeURIComponent(project.id)}`;
                  const shareUrl = `${window.location.origin}${sharePath}?${p.toString()}`;
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 1500);
                  } catch {
                    // Fallback: show URL in prompt
                    window.prompt('Copy this URL:', shareUrl);
                  }
                }}
              >
                {shareCopied ? 'Copied!' : 'Share'}
              </button>
            </>
          )}
          <button
            className={`yl-btn-ghost ${showSettings ? 'yl-active' : ''}`}
            onClick={() => {
              if (isPlayingRef.current || playback.status === 'playing' || playback.status === 'starting') {
                stop();
              }
              if (typeof navigate === 'function') {
                navigate(`${routeBase}/settings`);
                return;
              }
              window.location.assign(`${window.location.origin}${routeBase}/settings`);
            }}
            title="Open project settings"
          >
            ⚙ Settings
          </button>
          {(
            <div className="yl-ai-mask-controls">
              <label className="yl-sr-only" htmlFor="yl-ai-mask-level">Mask difficulty</label>
              <select id="yl-ai-mask-level" className="yl-select-sm" value={aiTranslationLevel}
                onChange={e => { const value = Number(e.target.value); setAiTranslationLevel(value); localStorage.setItem('yt_ai_level', String(value)); }}>
                <option value={0}>None</option>
                {[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>Mask {level}</option>)}
              </select>
              <button className="yl-btn-secondary yl-btn-sm" type="button" onClick={generateMask} disabled={aiMaskLoading || aiTranslationLevel === 0} title="Generate a simpler AI mask column">
                {aiMaskLoading ? 'Masking…' : maskVisible ? 'Refresh mask' : usesLocalDifficultyMask() ? 'Random mask' : 'AI mask'}
              </button>
              {maskVisible && (
                <>
                  <label className="yl-checkbox-label" title="Translate the AI mask instead of the subtitle text">
                    <input type="checkbox" checked={useMaskAsTranslationBase} onChange={e => setUseMaskAsTranslationBase(e.target.checked)} />
                    Translate mask
                  </label>
                  <button className="yl-btn-ghost yl-btn-sm" type="button" onClick={() => { setAiMaskRows({}); setUseMaskAsTranslationBase(false); setAiMaskError(''); }} title="Clear the AI mask column">
                    ✕
                  </button>
                </>
              )}
              {usesLocalDifficultyMask() && <span className="yl-setting-info yl-ai-mask-disclaimer">No OpenRouter key: this mask uses a random consecutive word selection, not AI.</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Audio player bar (shown when video is hidden but videoId exists) ── */}
      {audioOnlyMode && lines.length > 0 && (
        <div className="yl-audio-bar">
          <button
            className={`yl-audio-playbtn ${isPlaying ? 'yl-btn-stop' : ''}`}
            onClick={() => isPlaying ? stop() : playFrom(Math.max(0, currentLine >= 0 ? currentLine : project.lastLine))}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            className="yl-btn-ghost"
            title="Reset to the first line"
            onClick={resetToStart}
          >
            ⟲
          </button>
          <span className="yl-audio-time">{secondsToHms(currentTimeSec)}</span>
          <input
            className="yl-audio-seek"
            type="range"
            min={0}
            max={totalDuration || 1}
            step={1}
            value={currentTimeSec}
            onChange={e => handleAudioSeek(Number(e.target.value))}
          />
          <span className="yl-audio-time yl-audio-total">{secondsToHms(totalDuration)}</span>
          <button className="yl-btn-ghost yl-btn-sm" onClick={toggleVideo} title="Show video panel">
            📺 Show
          </button>
        </div>
      )}

      {/* ── Settings Panel ─────────────────────────────────────────────────── */}
      {showSettings && lines.length > 0 && (
        <div className="yl-settings">
          <div className="yl-settings-heading">
            <div>
              <strong>Project settings</strong>
              <span>Choose what is shown and how captions are read.</span>
            </div>
            <button className="yl-btn-ghost yl-btn-sm" onClick={() => setShowSettings(false)}>Close</button>
          </div>
          {settingsOnly && <div className="yl-settings-tabs" role="tablist" aria-label="YouTube settings">
            <button className="yl-settings-tab yl-settings-tab-active" role="tab" aria-selected="true">Translation</button>
            <button className="yl-settings-tab" role="tab" onClick={() => navigate(`${routeBase}/settings/openrouter`)}>OpenRouter</button>
          </div>}
          <div className="yl-settings-global">
            <label className="yl-setting-field yl-translation-setting">
              <span>Add language</span>
              <div className="yl-translation-setting-control">
                <input
                  className="yl-input-sm yl-target-input"
                  type="text"
                  list="yl-settings-lang-suggestions"
                  value={newTranslationLang}
                  onChange={e => setNewTranslationLang(e.target.value)}
                  aria-label="New translation language"
                  placeholder="ar, ru, he…"
                />
                <button
                  className="yl-btn-secondary yl-btn-sm"
                  type="button"
                  onClick={() => {
                    const next = newTranslationLang.trim();
                    if (!next) return;
                    toggleTranslation(next);
                    setNewTranslationLang('');
                  }}
                >
                  Add language
                </button>
                <datalist id="yl-settings-lang-suggestions">
                  {langOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </datalist>
              </div>
            </label>
            <label className="yl-setting-field">
              <span>Source column</span>
              <select className="yl-select-sm" value={config.translationSource}
                onChange={e => { updateConfig({ translationSource: e.target.value }); retranslate(); }}>
                {config.colOrder.filter(id => id.startsWith('track:')).map(id => (
                  <option key={id} value={id}>{colLabel(id, project)}</option>
                ))}
              </select>
            </label>
            <label className="yl-setting-field">
              <span>Visible lines</span>
              <input type="number" className="yl-input-sm" min={3} max={500}
                value={config.visibleLines}
                onChange={e => updateConfig({ visibleLines: Math.max(3, parseInt(e.target.value) || 30) })}
              />
            </label>
            <div className="yl-setting-field">
              <span>Cached translations</span>
              <span className="yl-setting-info">{cachedCount} line{cachedCount === 1 ? '' : 's'}</span>
            </div>
            <label className={`yl-setting-field yl-provider-setting ${subtitleServiceInfo.supportsAlternate ? '' : 'yl-provider-setting-disabled'}`}>
              <span>Alternate YouTube / Invidious host</span>
              <input
                className="yl-input-sm"
                type="text"
                placeholder="https://yewtu.be"
                value={alternateYoutubeUrl}
                onChange={e => setAlternateYoutubeUrl(e.target.value)}
                onBlur={() => saveProviderSettings({ alternateYoutubeUrl: alternateYoutubeUrl.trim() || undefined })}
                disabled={!subtitleServiceInfo.supportsAlternate}
                title={subtitleServiceInfo.supportsAlternate ? undefined : `Not supported by ${subtitleServiceInfo.library}`}
              />
            </label>
            <label className={`yl-setting-field yl-provider-setting ${subtitleServiceInfo.supportsProxy ? '' : 'yl-provider-setting-disabled'}`}>
              <span>Network route</span>
              <select className="yl-select-sm" value={proxyMode}
                onChange={e => {
                  const next = e.target.value as typeof proxyMode;
                  setProxyMode(next);
                  saveProviderSettings({ subtitleProxyUrl: next === 'tor' ? (subtitleProxyUrl || 'http://127.0.0.1:8118') : next === 'direct' ? undefined : subtitleProxyUrl || undefined });
                }}
                disabled={!subtitleServiceInfo.supportsProxy}>
                <option value="direct">Direct connection</option>
                <option value="http">HTTP / HTTPS proxy</option>
                <option value="tor">Tor via local HTTP bridge</option>
              </select>
              <input
                className="yl-input-sm"
                type="url"
                placeholder={proxyMode === 'tor' ? 'http://127.0.0.1:8118' : 'http://proxy.example:8080'}
                value={subtitleProxyUrl}
                onChange={e => setSubtitleProxyUrl(e.target.value)}
                onBlur={() => saveProviderSettings({ subtitleProxyUrl: proxyMode === 'direct' ? undefined : subtitleProxyUrl.trim() || undefined })}
                disabled={!subtitleServiceInfo.supportsProxy}
                title={subtitleServiceInfo.supportsProxy ? undefined : `Not supported by ${subtitleServiceInfo.library}`}
              />
              {subtitleServiceInfo.supportsProxy && proxyMode === 'tor' && <small className="yl-proxy-note">Tor must expose an HTTP bridge, commonly Privoxy at 127.0.0.1:8118.</small>}
            </label>
          </div>

          <div className="yl-settings-cols">
            {config.colOrder.map(colId => {
              const s = config.colSettings[colId];
              if (!s) return null;
              return (
                <div key={colId} data-col-id={colId} className={`yl-col-card ${s.visible ? '' : 'yl-col-card-hidden'}`}>
                  <div className="yl-col-card-header">
                    <span className="yl-col-card-name">{colLabel(colId, project)}</span>
                    {isTranslationCol(colId) && (
                      <button className="yl-btn-ghost yl-btn-sm" type="button"
                        onClick={() => removeTranslation(translationLang(colId, config))}
                        title="Remove translation">Remove</button>
                    )}
                    <label className="yl-toggle">
                      <input type="checkbox" checked={s.visible}
                        onChange={e => updateColSetting(colId, { visible: e.target.checked })} />
                      <span className="yl-toggle-track" />
                    </label>
                  </div>
                  <div className="yl-col-card-body">
                    <label className="yl-setting-field">
                      <span title="Play order (0 = skip)">Order</span>
                      <input type="number" className="yl-input-sm" min={0} max={10}
                        value={s.playOrder}
                        onChange={e => updateColSetting(colId, { playOrder: Math.max(0, parseInt(e.target.value) || 0) })}
                      />
                    </label>
                    {colId !== 'video' && (
                      <label className="yl-setting-field">
                        <span>Sound</span>
                        <input
                          type="checkbox"
                          checked={s.playOrder > 0}
                          onChange={e => updateColSetting(colId, { playOrder: e.target.checked ? Math.max(1, s.playOrder || 1) : 0 })}
                        />
                      </label>
                    )}
                    {colId !== 'video' && (() => {
                      const colLang = isTranslationCol(colId)
                        ? translationLang(colId, config)
                        : colId.replace('track:', '');
                      const colVoices = voicesForLang(colLang);
                      return (
                        <>
                          <label className="yl-setting-field">
                            <span>Speed {s.ttsRate.toFixed(1)}×</span>
                            <input type="range" min={0.5} max={2} step={0.1}
                              value={s.ttsRate}
                              onChange={e => updateColSetting(colId, { ttsRate: parseFloat(e.target.value) })}
                            />
                          </label>
                          {colVoices.length > 0 && (
                            <label className="yl-setting-field yl-voice-field">
                              <span>Voice</span>
                              <select
                                className="yl-select-sm yl-voice-select"
                                value={s.voiceName ?? ''}
                                onChange={e => updateColSetting(colId, { voiceName: e.target.value || undefined })}
                              >
                                <option value="">Auto</option>
                                {colVoices.map(v => (
                                  <option key={v.name} value={v.name}>
                                    {v.name}{v.localService ? '' : ' ☁'}
                                  </option>
                                ))}
                              </select>
                            </label>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Manage Languages ─────────────────────────────────────────── */}
          {project.videoId && (
            <div className="yl-manage-langs">
              <button
                className={`yl-btn-ghost yl-btn-sm ${showManageLangs ? 'yl-active' : ''}`}
                onClick={() => {
                  if (!showManageLangs && availLangs.length === 0) fetchAvailLangs();
                  setShowManageLangs(s => !s);
                  setLangsError('');
                }}
              >
                🌐 Manage languages
              </button>

              {showManageLangs && (
                <div className="yl-manage-langs-panel">
                  <div className="yl-manage-langs-section">
                    <span className="yl-manage-langs-label">Loaded tracks</span>
                    <div className="yl-lang-chips">
                      {project.tracks.map(t => (
                        <span key={t.lang} className="yl-lang-chip yl-lang-chip-loaded">
                          <span>{t.label || t.lang}</span>
                          {project.tracks.length > 1 && (
                            <button
                              className="yl-lang-chip-remove"
                              title={`Remove ${t.label}`}
                              onClick={() => removeLangTrack(t.lang)}
                            >✕</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="yl-manage-langs-section">
                    <span className="yl-manage-langs-label">
                      Add a subtitle
                      <button
                        className="yl-btn-ghost yl-btn-sm"
                        style={{ marginLeft: '0.4rem' }}
                        onClick={fetchAvailLangs}
                        disabled={langsLoading}
                        title="Refresh subtitle list"
                      >
                        {langsLoading ? '…' : '↺'}
                      </button>
                    </span>
                    {langsError && <p className="yl-error" style={{ margin: '0.2rem 0 0' }}>{langsError}</p>}
                    {langsLoading ? (
                      <span className="yl-manage-langs-hint">Fetching available languages…</span>
                    ) : (() => {
                      const unloaded = availLangs.filter(l =>
                        !project.tracks.some(t =>
                          t.lang === l.languageCode ||
                          t.lang.split('-')[0] === l.languageCode.split('-')[0]
                        )
                      );
                      if (availLangs.length > 0 && unloaded.length === 0) {
                        return <span className="yl-manage-langs-hint">All available languages are loaded.</span>;
                      }
                      return (
                        <div className="yl-lang-chips">
                          {unloaded.map(l => (
                            <button
                              key={l.languageCode}
                              className="yl-lang-chip yl-lang-chip-add"
                              disabled={addingLang !== null}
                              onClick={() => addLangTrack(l)}
                            >
                              {addingLang === l.languageCode ? '…' : '+'} {l.name}
                              {l.isAutoGenerated && <span className="yl-auto-badge">auto</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className={`yl-content${showVideo ? ' yl-split' : ''}`}>

        {/* Transcript Table */}
        <div className="yl-table-wrap">
          <div className="yl-nav-bar">
            <button className="yl-btn-ghost yl-btn-sm"
              disabled={windowStart === 0}
              onClick={() => setWindowStart(w => Math.max(0, w - config.visibleLines))}>
              ↑ Prev
            </button>
            <span className="yl-nav-info">
              Lines {windowStart + 1}–{Math.min(windowStart + config.visibleLines, lines.length)} of {lines.length}
            </span>
            <button className="yl-btn-ghost yl-btn-sm"
              disabled={windowStart + config.visibleLines >= lines.length}
              onClick={() => setWindowStart(w => Math.min(lines.length - config.visibleLines, w + config.visibleLines))}>
              ↓ Next
            </button>
            <span className={`yl-translation-status yl-translation-status-${translationStatus}`} role="status">
              <span className="yl-translation-status-dot" />
              {translationStatusMessage || 'Translation on demand'}
            </span>
            {aiMaskLoading && <span className="yl-translation-status">Generating AI mask…</span>}
            {aiMaskError && <span className="yl-translation-status yl-translation-status-rate-limited">{aiMaskError}</span>}
          </div>

          <table className="yl-table">
            <thead>
              <tr>
                <th className="yl-th-time">Time</th>
                {displayCols.map(colId => (
                  <th key={colId} className="yl-th-text"
                    dir={colId === 'ai-mask' ? 'ltr' : isTranslationCol(colId) ? (isRtl(translationLang(colId, config)) ? 'rtl' : 'ltr') : undefined}>
                    {colId === 'ai-mask' ? `AI mask · ${aiTranslationLevel} words${useMaskAsTranslationBase ? ' (translation base)' : ''}` : colLabel(colId, project)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(line => (
                <tr
                  key={line.index}
                  ref={el => { rowRefs.current[line.index] = el; }}
                  className={`yl-row${line.index === currentLine ? ' yl-row-active' : ''}`}
                  onClick={() => handleRowClick(line.index)}
                >
                  <td className="yl-td-time">{secondsToHms(line.startSec)}</td>
                  {displayCols.map(colId => {
                    if (colId === 'ai-mask') {
                      return <td key={colId} className="yl-td-text">{aiMaskRows[line.index] || 'Not generated'}</td>;
                    }
                    const isTrans = isTranslationCol(colId);
                    const transLang = translationLang(colId, config);
                    const text = isTrans
                      ? (line.translatedTargets?.[transLang] ? (line.translations?.[transLang] || '') : '')
                      : (line.texts[colId] || '');
                    const rtl = isTrans
                      ? isRtl(transLang)
                      : isRtl(colId.replace('track:', ''));
                    const isLoading = isTrans && translatingIndices.has(line.index);
                    return (
                      <td key={colId} className="yl-td-text" dir={rtl ? 'rtl' : 'ltr'}>
                        {isLoading ? (
                          <span className="yl-translation-loading">Translating…</span>
                        ) : isTrans && !line.translatedTargets?.[transLang] ? (
                          <span className="yl-translation-on-demand">On demand</span>
                        ) : (
                          renderHighlightedText(text, line.index, colId)
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* YouTube Iframe */}
        {showVideo && (
          <div className="yl-video-wrap">
            {seamlessMode ? (
              // Seamless mode: single persistent iframe, controlled via postMessage
              <iframe
                key={`seamless-${project.videoId}`}
                ref={iframeRef}
                className="yl-iframe"
                src={seamlessIframeUrl}
                title={project.title}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                onLoad={() => startListening(iframeRef)}
              />
            ) : (
              // Classic mode: re-keyed per segment
              <iframe
                key={iframeKey}
                className="yl-iframe"
                src={iframeKey === 0
                  ? `https://www.youtube-nocookie.com/embed/${project.videoId}?rel=0&modestbranding=1&enablejsapi=1`
                  : classicIframeUrl}
                title={project.title}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                onLoad={() => startListening(iframeRef)}
              />
            )}
          </div>
        )}
      </div>

      {/* Background audio iframe is only used when video is hidden, so the app never runs two playback streams at once. */}
      {project.videoId && !showVideo && (
        <iframe
          key={`audio-bg-${project.videoId}`}
          ref={audioRef}
          src={seamlessIframeUrl}
          title="audio-bg"
          allow="autoplay; encrypted-media"
          className="yl-iframe-bg"
          onLoad={() => startListening(audioRef)}
        />
      )}
    </div>
  );
}
