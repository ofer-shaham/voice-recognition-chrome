import React, { useState } from 'react';
import { YtProject, YtTrack, ProjectConfig } from './types';
import { LANG_OPTIONS, DEFAULT_TTS_RATE, DEFAULT_VISIBLE_LINES } from './constants';
import appConfig from '../../config/appConfig.json';
import { extractVideoId } from './utils';
import { fetchVideoInfo, fetchSubtitlesSrt, SubtitleInfo } from '../../services/youtubeTranscriptService';

interface Props {
  onProjectReady: (project: YtProject) => void;
  recentProject: YtProject | null;
  hasHistory: boolean;
  onLoadRecent: () => void;
  onClearHistory: () => void;
}

type Step = 'url' | 'langs';

function buildProject(
  id: string,
  videoId: string,
  title: string,
  tracks: YtTrack[],
  targetLang: string
): YtProject {
  const colOrder: string[] = [...tracks.map(t => `track:${t.lang}`), 'translation', 'video'];
  const colSettings: ProjectConfig['colSettings'] = {};
  tracks.forEach((t, i) => {
    colSettings[`track:${t.lang}`] = { visible: true, playOrder: i + 1, ttsRate: DEFAULT_TTS_RATE };
  });
  colSettings['translation'] = { visible: true, playOrder: tracks.length + 1, ttsRate: 0.9 };
  colSettings['video'] = { visible: !!videoId, playOrder: tracks.length + 2, ttsRate: DEFAULT_TTS_RATE };

  const config: ProjectConfig = {
    targetLang,
    translationSource: `track:${tracks[0].lang}`,
    colOrder,
    colSettings,
    visibleLines: DEFAULT_VISIBLE_LINES,
  };

  return { id, videoId, title, createdAt: Date.now(), updatedAt: Date.now(), tracks, config, lastLine: 0 };
}

export default function SetupView({ onProjectReady, recentProject, hasHistory, onLoadRecent, onClearHistory }: Props) {
  const [step, setStep] = useState<Step>('url');

  // ── URL step ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState(appConfig.youtube.defaultUrl);
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState('');

  // ── Language selection step ──────────────────────────────────────────────
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState<string>('');
  const [manualSubtitles, setManualSubtitles] = useState<SubtitleInfo[]>([]);
  const [autoTranslatedSubtitles, setAutoTranslatedSubtitles] = useState<SubtitleInfo[]>([]);
  const [selectedManual, setSelectedManual] = useState<string>('');
  const [selectedAuto, setSelectedAuto] = useState<Set<string>>(new Set());
  const [targetLang, setTargetLang] = useState(appConfig.youtube.defaultTargetLanguage);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const handleFindVideo = async () => {
    setFindError('');
    const vid = extractVideoId(url.trim());
    if (!vid) { setFindError('Could not extract a video ID from that URL.'); return; }
    setFindLoading(true);
    try {
      const data = await fetchVideoInfo(vid);
      const manual = data.manualSubtitles;
      const auto = data.autoTranslatedSubtitles;

      if (!manual.length) throw new Error('No subtitle tracks found for this video.');

      // Default: code ending with "_auto", otherwise first item
      const defaultManual = manual.find(s => s.code.endsWith('_auto'))?.code || manual[0].code;

      setVideoId(vid);
      setVideoTitle(data.title);
      setManualSubtitles(manual);
      setAutoTranslatedSubtitles(auto);
      setSelectedManual(defaultManual);
      setSelectedAuto(new Set());
      setStep('langs');
    } catch (e: any) {
      setFindError(e.message || 'Failed to fetch video info');
    }
    setFindLoading(false);
  };

  const toggleAutoLang = (code: string) => {
    setSelectedAuto(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleLoad = async () => {
    setFetchError('');
    if (!selectedManual) { setFetchError('Select a primary transcript language.'); return; }
    if (!targetLang.trim()) { setFetchError('Enter a target language for translation.'); return; }
    setFetchLoading(true);
    try {
      const tracks: YtTrack[] = [];

      // Fetch primary manual subtitle
      const primarySrt = await fetchSubtitlesSrt(videoId, selectedManual);
      const primaryInfo = manualSubtitles.find(s => s.code === selectedManual);
      tracks.push({
        lang: selectedManual,
        label: primaryInfo?.name || selectedManual,
        isAuto: selectedManual.endsWith('_auto'),
        srtContent: primarySrt,
      });

      // Fetch selected autoTranslated subtitles
      for (const code of Array.from(selectedAuto)) {
        const srtContent = await fetchSubtitlesSrt(videoId, code);
        const info = autoTranslatedSubtitles.find(s => s.code === code);
        tracks.push({
          lang: code,
          label: info?.name || code,
          isAuto: true,
          srtContent,
        });
      }

      onProjectReady(buildProject(videoId, videoId, videoTitle || videoId, tracks, targetLang.trim()));
    } catch (e: any) {
      setFetchError(e.message || 'Error fetching subtitles');
    }
    setFetchLoading(false);
  };

  const handleBack = () => {
    setStep('url');
    setFindError('');
    setFetchError('');
  };

  // ── Render: language selection ───────────────────────────────────────────────
  if (step === 'langs') {
    return (
      <div className="yl-setup">
        <div className="yl-setup-hero">
          <h1 className="yl-setup-title">YouTube Language Learner</h1>
          {videoTitle && <p className="yl-setup-subtitle">{videoTitle}</p>}
        </div>

        <div className="yl-setup-form">
          <label className="yl-label">Primary transcript (manual/auto-generated)</label>
          <select
            className="yl-select"
            value={selectedManual}
            onChange={e => setSelectedManual(e.target.value)}
          >
            {manualSubtitles.map(s => (
              <option key={s.code} value={s.code}>
                {s.name}{s.code.endsWith('_auto') ? ' (auto)' : ''}
              </option>
            ))}
          </select>

          {autoTranslatedSubtitles.length > 0 && (
            <details className="yl-extra-langs" open>
              <summary className="yl-label">Add auto-translated subtitles (select multiple)</summary>
              <div className="yl-lang-chips">
                {autoTranslatedSubtitles.map(s => (
                  <button
                    key={s.code}
                    type="button"
                    className={`yl-lang-chip ${selectedAuto.has(s.code) ? 'yl-lang-chip-loaded' : 'yl-lang-chip-add'}`}
                    onClick={() => toggleAutoLang(s.code)}
                  >
                    {selectedAuto.has(s.code) ? '✓' : '+'} {s.name}
                  </button>
                ))}
              </div>
            </details>
          )}

          <label className="yl-label">Translate subtitles to</label>
          <input
            className="yl-input"
            type="text"
            list="yl-lang-suggestions"
            placeholder="en, he, ar…"
            value={targetLang}
            onChange={e => setTargetLang(e.target.value)}
          />
          <datalist id="yl-lang-suggestions">
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </datalist>

          {fetchError && <p className="yl-error">{fetchError}</p>}

          <div className="yl-setup-actions">
            <button className="yl-btn-secondary" onClick={handleBack} type="button" disabled={fetchLoading}>
              ← Back
            </button>
            <button className="yl-btn-primary yl-btn-full" onClick={handleLoad} disabled={fetchLoading}>
              {fetchLoading ? 'Loading…' : 'Load Video →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: URL step ──────────────────────────────────────────────────────────
  return (
    <div className="yl-setup">
      <div className="yl-setup-hero">
        <h1 className="yl-setup-title">YouTube Language Learner</h1>
        <p className="yl-setup-subtitle">
          Watch YouTube videos with synchronized multi-language transcripts and TTS playback.
        </p>
      </div>

      {recentProject && (
        <div className="yl-recent-card">
          <div>
            <div className="yl-recent-label">Resume where you left off</div>
            <div className="yl-recent-title">{recentProject.title}</div>
          </div>
          <button className="yl-btn-primary" onClick={onLoadRecent}>Resume →</button>
        </div>
      )}

      {hasHistory && (
        <div className="yl-clear-history">
          <button className="yl-btn-ghost-danger" onClick={() => {
            if (window.confirm('Clear all YouTube history? This cannot be undone.')) onClearHistory();
          }}>
            Clear history
          </button>
        </div>
      )}

      <div className="yl-setup-form">
        <label className="yl-label">YouTube URL or Video ID</label>
        <input
          className="yl-input"
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFindVideo()}
          autoFocus
        />

        {findError && <p className="yl-error">{findError}</p>}

        <button className="yl-btn-primary yl-btn-full" onClick={handleFindVideo} disabled={findLoading || !url.trim()}>
          {findLoading ? 'Loading video info…' : 'Find subtitles →'}
        </button>
      </div>
    </div>
  );
}
