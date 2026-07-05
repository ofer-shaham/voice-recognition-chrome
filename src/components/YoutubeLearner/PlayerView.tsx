import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { YtProject, YtTrack, ParsedLine, ProjectConfig, ColSetting, AvailableLang } from './types';
import { buildLines, parseSrt, secondsToHms, colLabel, sleep, dedupeAvailLangs } from './utils';
import { DEFAULT_TTS_RATE } from './constants';
import { translate, getTranslationCacheCount } from '../../utils/translate';
import { freeSpeak } from '../../utils/freeSpeak';
import isRtl from '../../utils/isRtl';
import { useVoices } from './useVoices';

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
  navigator.mediaSession.setActionHandler('play', () => {});
  navigator.mediaSession.setActionHandler('pause', () => {});
  navigator.mediaSession.setActionHandler('nexttrack', () => {});
  navigator.mediaSession.setActionHandler('previoustrack', () => {});
}

interface Props {
  project: YtProject;
  onSave: (p: YtProject) => void;
  onNewVideo: () => void;
  onDelete: (id: string) => void;
  projects: YtProject[];
  onSelectProject: (p: YtProject) => void;
}

// Encode colId for URL: track:en → en, translation → t
const shortCol = (id: string) => id === 'translation' ? 't' : id.replace('track:', '');

export default function PlayerView({ project, onSave, onNewVideo, onDelete, projects, onSelectProject }: Props) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const defaultVisibleLines = () => {
    const params = new URLSearchParams(window.location.search);
    const urlVl = parseInt(params.get('vl') || '', 10);
    if (!isNaN(urlVl) && urlVl >= 3) return urlVl;
    return isMobile ? 3 : 30; // Mobile: 1 before + current + 1 after
  };

  const [lines, setLines]               = useState<ParsedLine[]>([]);
  const [config, setConfig]             = useState<ProjectConfig>(() => ({
    ...project.config,
    visibleLines: defaultVisibleLines(),
  }));
  const [isPlaying, setIsPlaying]       = useState(false);
  const [currentLine, setCurrentLine]   = useState(-1);
  const [windowStart, setWindowStart]   = useState(0);
  const [iframeSeg, setIframeSeg]       = useState({ startSec: 0, endSec: 0 });
  const [iframeKey, setIframeKey]       = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [translationVer, setTranslationVer] = useState(0);
  const [currentWord, setCurrentWord]       = useState<{ lineIdx: number; charIndex: number; charLength: number } | null>(null);
  const [seamlessMode, setSeamlessMode]       = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('sm') !== '0'; // Default true, only false if sm=0
  });
  const [confirmDelete, setConfirmDelete]     = useState(false);
  const [showManageLangs, setShowManageLangs] = useState(false);
  const [availLangs, setAvailLangs]           = useState<AvailableLang[]>([]);
  const [langsLoading, setLangsLoading]       = useState(false);
  const [langsError, setLangsError]           = useState('');
  const [addingLang, setAddingLang]           = useState<string | null>(null);
  const [cachedCount, setCachedCount]         = useState(() => getTranslationCacheCount());

  const { langOptions, voicesForLang } = useVoices();

  const cancelRef      = useRef(false);
  const linesRef       = useRef<ParsedLine[]>([]);
  const configRef      = useRef<ProjectConfig>(project.config);
  const projectRef     = useRef<YtProject>(project);
  const pendingSet     = useRef<Set<number>>(new Set());
  const rowRefs        = useRef<Record<number, HTMLTableRowElement | null>>({});
  const iframeRef      = useRef<HTMLIFrameElement>(null);  // seamless visible iframe
  const audioRef       = useRef<HTMLIFrameElement>(null);  // always-present background audio iframe
  const seamlessRef    = useRef(false);
  const showVideoRef   = useRef(true);
  const audioOnlyRef   = useRef(false);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { seamlessRef.current = seamlessMode; }, [seamlessMode]);

  // ── Derived: video visible? audio-only mode? ─────────────────────────────────
  const showVideo      = config.colSettings['video']?.visible && !!project.videoId;
  const audioOnlyMode  = !showVideo && !!project.videoId;
  const totalDuration  = lines.length > 0 ? lines[lines.length - 1].endSec : 0;
  const currentTimeSec = currentLine >= 0 ? (lines[currentLine]?.startSec ?? 0) : 0;

  useEffect(() => { showVideoRef.current  = showVideo;     }, [showVideo]);
  useEffect(() => { audioOnlyRef.current  = audioOnlyMode; }, [audioOnlyMode]);

  // ── URL sync: reflect project + config in address bar ───────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (project.videoId) p.set('v', project.videoId);
    else p.set('p', project.id);
    p.set('tl', config.targetLang);
    p.set('l', String(project.lastLine));
    p.set('sm', seamlessMode ? '1' : '0');
    p.set('vl', String(config.visibleLines));
    for (const [colId, s] of Object.entries(config.colSettings)) {
      if (colId === 'video') continue;
      const sid = shortCol(colId);
      if (s.ttsRate !== DEFAULT_TTS_RATE) p.set(`r_${sid}`, s.ttsRate.toFixed(1));
      if (s.voiceName) p.set(`vn_${sid}`, s.voiceName);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [project.id, project.videoId, project.lastLine, config, seamlessMode]);

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
    setConfig({ ...project.config, visibleLines });
    // Read line number from URL if present
    const urlLine = parseInt(params.get('l') || '', 10);
    const startLine = !isNaN(urlLine) && urlLine >= 0 && urlLine < parsed.length ? urlLine : project.lastLine;
    setWindowStart(Math.max(0, startLine - 3));
    setTranslationVer(v => v + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // ── Background translation ───────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (lines.length === 0) return; // Wait for lines to be populated
      const indices = Array.from(pendingSet.current).sort((a, b) => a - b);
      for (const i of indices) {
        if (cancelled) break;
        const line = linesRef.current[i];
        if (!line || line.translated) { pendingSet.current.delete(i); continue; }
        const cfg = configRef.current;
        const srcText = line.texts[cfg.translationSource] || '';
        if (!srcText.trim()) {
          pendingSet.current.delete(i);
          setLines(prev => prev.map((l, idx) => idx === i ? { ...l, translation: '', translated: true } : l));
          continue;
        }
        try {
          const fromLang = cfg.translationSource.replace('track:', '').split('-')[0];
          const result = await translate({ finalTranscriptProxy: srcText, fromLang, toLang: cfg.targetLang });
          pendingSet.current.delete(i);
          setLines(prev => prev.map((l, idx) => idx === i ? { ...l, translation: result, translated: true } : l));
          setCachedCount(getTranslationCacheCount());
        } catch { /* ignore individual failures */ }
        if (i % 10 === 9) await sleep(80);
      }
    };
    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationVer, lines.length]);

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
  const updateConfig = useCallback((patch: Partial<ProjectConfig>) => {
    setConfig(prev => {
      const next = { ...prev, ...patch };
      configRef.current = next;
      onSave({ ...projectRef.current, config: next, updatedAt: Date.now() });
      return next;
    });
  }, [onSave]);

  const updateColSetting = useCallback((colId: string, patch: Partial<ColSetting>) => {
    setConfig(prev => {
      const next = { ...prev, colSettings: { ...prev.colSettings, [colId]: { ...prev.colSettings[colId], ...patch } } };
      configRef.current = next;
      onSave({ ...projectRef.current, config: next, updatedAt: Date.now() });
      return next;
    });
  }, [onSave]);

  const retranslate = useCallback(() => {
    setLines(prev => {
      pendingSet.current = new Set(prev.map((_, i) => i));
      return prev.map(l => ({ ...l, translation: '', translated: false }));
    });
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
      const res = await fetch(`/api/transcript/languages?videoId=${encodeURIComponent(projectRef.current.videoId)}`);
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
      const res = await fetch(`/api/srt?videoId=${encodeURIComponent(projectRef.current.videoId)}&lang=${langCode}`);
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || `HTTP ${res.status}`); }
      const srtContent = await res.text();
      const newTrack: YtTrack = { lang: lang.languageCode, label: lang.name, isAuto: lang.isAutoGenerated, srtContent };
      const p = projectRef.current;
      const newTracks = [...p.tracks, newTrack];
      const colId = `track:${lang.languageCode}`;
      const trackCols = p.config.colOrder.filter(id => id !== 'translation' && id !== 'video');
      const newColOrder = [...trackCols, colId, 'translation', 'video'];
      const newColSettings = {
        ...p.config.colSettings,
        [colId]: { visible: true, playOrder: newTracks.length, ttsRate: DEFAULT_TTS_RATE },
      };
      const newConfig = { ...p.config, colOrder: newColOrder, colSettings: newColSettings };
      const updatedProject = { ...p, tracks: newTracks, config: newConfig, updatedAt: Date.now() };
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

  // ── YouTube postMessage control ──────────────────────────────────────────────
  // Routes to: visible seamless iframe (iframeRef) when seamless+video, else background audio iframe (audioRef)
  const ytCmd = useCallback((func: string, args: any[] = []) => {
    try {
      const target = (seamlessRef.current && showVideoRef.current) ? iframeRef : audioRef;
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
    } catch { /* ignore cross-origin errors */ }
  }, []);

  // ── Sync row position to actual iframe playback location ─────────────────────
  // Listens for YouTube IFrame API "infoDelivery" messages (sent after a
  // "listening" handshake) and, whenever the reported currentTime lands in a
  // different subtitle line than the one we're currently showing, moves the
  // active row to follow the video — covers native seeks/scrubbing/play done
  // directly on the embedded player rather than through our own controls.
  const currentLineRef = useRef(-1);
  useEffect(() => { currentLineRef.current = currentLine; }, [currentLine]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== 'string') return;
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data?.event !== 'infoDelivery' || !data.info) return;
      const t = data.info.currentTime;
      if (typeof t !== 'number') return;
      const ls = linesRef.current;
      if (!ls.length) return;
      let idx = -1;
      for (let i = 0; i < ls.length; i++) {
        if (t >= ls[i].startSec && (i === ls.length - 1 || t < ls[i + 1].startSec)) { idx = i; break; }
      }
      if (idx === -1) idx = t <= ls[0].startSec ? 0 : ls.length - 1;
      if (idx !== currentLineRef.current) {
        currentLineRef.current = idx;
        setCurrentLine(idx);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────────
  const playLine = useCallback(async (lineIdx: number) => {
    const line = linesRef.current[lineIdx];
    const cfg  = configRef.current;
    if (!line) return;

    const isSeamless = seamlessRef.current;

    const playable = cfg.colOrder
      .filter(id => cfg.colSettings[id]?.visible && (cfg.colSettings[id]?.playOrder ?? 0) > 0)
      .sort((a, b) => (cfg.colSettings[a]?.playOrder ?? 0) - (cfg.colSettings[b]?.playOrder ?? 0));

    for (const colId of playable) {
      if (cancelRef.current) return;
      const s = cfg.colSettings[colId];

      if (colId === 'video') {
        if (isSeamless || audioOnlyRef.current) {
          // Seamless/audio-only mode: seek + play the persistent iframe, then pause after duration
          const dur = Math.max(500, (line.endSec - line.startSec) * 1000);
          ytCmd('seekTo', [line.startSec, true]);
          await sleep(200);
          ytCmd('playVideo');
          await sleep(dur);
          ytCmd('pauseVideo');
        } else {
          // Classic mode: re-key the iframe to play just this segment
          setIframeSeg({ startSec: line.startSec, endSec: line.endSec });
          setIframeKey(k => k + 1);
          await sleep(Math.max(1000, (line.endSec - line.startSec) * 1000 + 800));
        }
      } else {
        const text = colId === 'translation'
          ? (linesRef.current[lineIdx]?.translation || '')
          : (line.texts[colId] || '');
        const lang = colId === 'translation'
          ? cfg.targetLang
          : colId.replace('track:', '');
        if (text.trim()) {
          setCurrentWord(null); // Reset before new speech
          try {
            await freeSpeak(
              text,
              lang,
              s?.ttsRate ?? DEFAULT_TTS_RATE,
              s?.voiceName || undefined,
              (charIndex, charLength) => setCurrentWord({ lineIdx, charIndex, charLength })
            );
          } catch { /* ignore */ }
          setCurrentWord(null);
        }
      }
      if (cancelRef.current) return;
    }
  }, [ytCmd]);

  const stop = useCallback(() => {
    cancelRef.current = true;
    speechSynthesis.cancel();
    ytCmd('pauseVideo');
    releaseWakeLock();
    setIsPlaying(false);
    setCurrentLine(-1);
  }, [ytCmd]);

  const playFrom = useCallback(async (startIdx: number) => {
    // Ensure video is paused before starting new playback
    ytCmd('pauseVideo');
    cancelRef.current = false;
    setIsPlaying(true);
    await requestWakeLock();
    for (let i = startIdx; i < linesRef.current.length; i++) {
      if (cancelRef.current) break;
      setCurrentLine(i);
      onSave({ ...projectRef.current, lastLine: i, updatedAt: Date.now() });
      await playLine(i);
    }
    if (!cancelRef.current) {
      ytCmd('pauseVideo');
      releaseWakeLock();
      setIsPlaying(false);
      setCurrentLine(-1);
    }
  }, [playLine, onSave, ytCmd]);

  // Reset the active row back to the very first line
  const resetToStart = useCallback(() => {
    if (isPlaying) stop();
    ytCmd('seekTo', [0, true]);
    setCurrentLine(-1);
    setWindowStart(0);
    onSave({ ...projectRef.current, lastLine: 0, updatedAt: Date.now() });
  }, [isPlaying, stop, ytCmd, onSave]);

  // ── Derived ──────────────────────────────────────────────────────────────────
  const visibleCols = useMemo(
    () => config.colOrder.filter(id => id !== 'video' && config.colSettings[id]?.visible),
    [config.colOrder, config.colSettings]
  );
  const visibleRows = lines.slice(windowStart, windowStart + config.visibleLines);

  // Helper to render text with word highlighting
  const renderHighlightedText = (text: string, lineIdx: number) => {
    if (!currentWord || currentWord.lineIdx !== lineIdx) {
      return text;
    }
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
  };

  // Classic mode iframe URL (segment-specific, re-keyed)
  const classicIframeUrl = `https://www.youtube-nocookie.com/embed/${project.videoId}` +
    `?start=${Math.floor(iframeSeg.startSec)}&end=${Math.ceil(iframeSeg.endSec)}` +
    `&autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;

  // Seamless mode iframe URL (full video, persistent, JS API enabled)
  const seamlessIframeUrl = `https://www.youtube-nocookie.com/embed/${project.videoId}` +
    `?enablejsapi=1&rel=0&modestbranding=1&autoplay=0&playsinline=1`;

  const handleRowClick = (lineIdx: number) => {
    if (isPlaying) { stop(); setTimeout(() => playFrom(lineIdx), 150); }
    else { playFrom(lineIdx); }
  };

  const handleSeamlessToggle = () => {
    if (isPlaying) stop();
    setSeamlessMode(s => !s);
    setIframeKey(k => k + 1);
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
    else { setCurrentLine(idx); }
  };

  // ── SRT download ─────────────────────────────────────────────────────────────
  const [showDownload, setShowDownload] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const downloadSrt = useCallback((track: { label: string; srtContent: string }) => {
    const safe = (project.title + '-' + track.label).replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
    const blob = new Blob([track.srtContent], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${safe}.srt`;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownload(false);
  }, [project.title]);

  return (
    <div className="yl-player">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="yl-header">
        <div className="yl-header-left">
          <button className="yl-btn-ghost" onClick={onNewVideo}>＋ New</button>
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

          {/* ── Target language (always editable) ── */}
          <div className="yl-menu-lang-wrap">
            <label className="yl-menu-lang-label">Translate to</label>
            <input
              className="yl-menu-lang-input"
              type="text"
              list="yl-header-lang-suggestions"
              value={config.targetLang}
              onChange={e => { updateConfig({ targetLang: e.target.value }); retranslate(); }}
              placeholder="en, he, ar…"
              title="Target language code for translation (e.g. en, he, ar, ru)"
            />
            <datalist id="yl-header-lang-suggestions">
              {langOptions.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </datalist>
          </div>

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

              {project.videoId && (
                <button
                  className={`yl-btn-ghost ${showVideo ? 'yl-active' : ''}`}
                  onClick={toggleVideo}
                  title={showVideo ? 'Hide video' : 'Show video'}
                >
                  {showVideo ? '📺 Hide' : '📺 Video'}
                </button>
              )}
              {showVideo && (
                <button
                  className={`yl-btn-ghost ${seamlessMode ? 'yl-active yl-btn-seamless-on' : ''}`}
                  onClick={handleSeamlessToggle}
                  title="Seamless mode: plays the full video and pauses at each subtitle for TTS"
                >
                  🎬 Seamless
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
                onClick={() => isPlaying ? stop() : playFrom(Math.max(0, currentLine >= 0 ? currentLine : project.lastLine))}
              >
                {isPlaying ? '⏹ Stop' : '▶ Play'}
              </button>
              <button
                className={`yl-btn-ghost ${shareCopied ? 'yl-btn-share-copied' : ''}`}
                title="Share this position and settings"
                onClick={async () => {
                  const p = new URLSearchParams();
                  if (project.videoId) p.set('v', project.videoId);
                  else p.set('p', project.id);
                  p.set('tl', config.targetLang);
                  p.set('l', String(currentLine >= 0 ? currentLine : project.lastLine));
                  p.set('sm', seamlessMode ? '1' : '0');
                  for (const [colId, s] of Object.entries(config.colSettings)) {
                    if (colId === 'video') continue;
                    const sid = shortCol(colId);
                    if (s.ttsRate !== DEFAULT_TTS_RATE) p.set(`r_${sid}`, s.ttsRate.toFixed(1));
                    if (s.voiceName) p.set(`vn_${sid}`, s.voiceName);
                  }
                  const shareUrl = `${window.location.origin}${window.location.pathname}?${p.toString()}`;
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
              <button className={`yl-btn-ghost ${showSettings ? 'yl-active' : ''}`} onClick={() => setShowSettings(s => !s)}>
                ⚙ Settings
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Seamless mode banner ────────────────────────────────────────────── */}
      {seamlessMode && showVideo && (
        <div className="yl-seamless-banner">
          🎬 Seamless mode — the video plays each subtitle, then pauses while TTS reads it aloud.
        </div>
      )}

      {/* ── Audio player bar (shown when video is hidden but videoId exists) ── */}
      {audioOnlyMode && lines.length > 0 && (
        <div className="yl-audio-bar">
          <button
            className={`yl-audio-playbtn ${isPlaying ? 'yl-btn-stop' : ''}`}
            onClick={() => isPlaying ? stop() : playFrom(Math.max(0, currentLine >= 0 ? currentLine : project.lastLine))}
          >
            {isPlaying ? '⏹' : '▶'}
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
          <div className="yl-settings-global">
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
                <div key={colId} className={`yl-col-card ${s.visible ? '' : 'yl-col-card-hidden'}`}>
                  <div className="yl-col-card-header">
                    <span className="yl-col-card-name">{colLabel(colId, project)}</span>
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
                    {colId !== 'video' && (() => {
                      const colLang = colId === 'translation'
                        ? config.targetLang
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
                      Add language
                      <button
                        className="yl-btn-ghost yl-btn-sm"
                        style={{ marginLeft: '0.4rem' }}
                        onClick={fetchAvailLangs}
                        disabled={langsLoading}
                        title="Refresh language list"
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
          </div>

          <table className="yl-table">
            <thead>
              <tr>
                <th className="yl-th-time">Time</th>
                {visibleCols.map(colId => (
                  <th key={colId} className="yl-th-text"
                    dir={colId === 'translation' ? (isRtl(config.targetLang) ? 'rtl' : 'ltr') : undefined}>
                    {colLabel(colId, project)}
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
                  {visibleCols.map(colId => {
                    const isTrans = colId === 'translation';
                    const text = isTrans
                      ? (line.translated ? line.translation : '')
                      : (line.texts[colId] || '');
                    const rtl = isTrans
                      ? isRtl(config.targetLang)
                      : isRtl(colId.replace('track:', ''));
                    const isLoading = isTrans && !line.translated;
                    return (
                      <td key={colId} className="yl-td-text" dir={rtl ? 'rtl' : 'ltr'}>
                        {isLoading ? (
                          <span className="yl-translation-loading">Translating…</span>
                        ) : (
                          renderHighlightedText(text, line.index)
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

      {/* Always-present background audio iframe — invisible, provides audio when video is hidden */}
      {project.videoId && (
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
