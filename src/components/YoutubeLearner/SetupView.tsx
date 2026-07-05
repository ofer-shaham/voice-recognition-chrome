import React, { useState, useRef } from 'react';
import { YtProject, YtTrack, ProjectConfig } from './types';
import { LANG_OPTIONS, DEFAULT_TTS_RATE, DEFAULT_VISIBLE_LINES } from './constants';
import { extractVideoId } from './utils';

interface Props {
  onProjectReady: (project: YtProject) => void;
  recentProject: YtProject | null;
  onLoadRecent: () => void;
}

type Mode = 'fetch' | 'manual';
type FetchStep = 'url' | 'loading';

interface ManTrack {
  label: string;
  lang: string;
  srt: string;
}

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

export default function SetupView({ onProjectReady, recentProject, onLoadRecent }: Props) {
  const [mode, setMode] = useState<Mode>('fetch');

  // ── Fetch mode state ─────────────────────────────────────────────────────
  const [fetchStep, setFetchStep] = useState<FetchStep>('url');
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=prSfxdmjNzE');
  const [subtitlesLang, setSubtitlesLang] = useState('ru');
  const [targetLang, setTargetLang] = useState('he');
  const [fetchError, setFetchError] = useState('');
  const [loadingMsg, setLoadingMsg] = useState('');

  // ── Manual mode state ────────────────────────────────────────────────────
  const [manTitle, setManTitle] = useState('');
  const [manVideoUrl, setManVideoUrl] = useState('');
  const [manTargetLang, setManTargetLang] = useState('he');
  const [manTracks, setManTracks] = useState<ManTrack[]>([{ label: '', lang: 'en', srt: '' }]);
  const [manError, setManError] = useState('');
  const [manInputMode, setManInputMode] = useState<'paste' | 'upload'>('paste');
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Fetch mode handlers ───────────────────────────────────────────────────
  const handleLoadUrl = async () => {
    setFetchError('');
    const vid = extractVideoId(url.trim());
    if (!vid) { setFetchError('Could not extract video ID from URL.'); return; }
    setLoadingMsg('Fetching subtitles…');
    setFetchStep('loading');
    try {
      const encodedUrl = encodeURIComponent(url.trim());
      const res = await fetch(`https://youtube-dl-jrte.onrender.com/api/subtitles?url=${encodedUrl}&type=srt&language=${subtitlesLang}&download=1`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `HTTP ${res.status}`);
      }
      const srtContent = await res.text();
      if (!srtContent.trim()) {
        throw new Error('No subtitles found for this language.');
      }
      const track: YtTrack = {
        lang: subtitlesLang,
        label: LANG_OPTIONS.find(l => l.code === subtitlesLang)?.label || subtitlesLang,
        isAuto: false,
        srtContent,
      };
      onProjectReady(buildProject(vid, vid, vid, [track], targetLang));
    } catch (e: any) {
      setFetchError(e.message || 'Error fetching subtitles');
      setFetchStep('url');
    }
  };

  // ── Manual mode handlers ──────────────────────────────────────────────────
  const updateManTrack = (i: number, patch: Partial<ManTrack>) => {
    setManTracks(prev => prev.map((t, idx) => idx === i ? { ...t, ...patch } : t));
  };

  const addManTrack = () => setManTracks(prev => [...prev, { label: '', lang: 'en', srt: '' }]);

  const removeManTrack = (i: number) => setManTracks(prev => prev.filter((_, idx) => idx !== i));

  const handleFileChange = (i: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      updateManTrack(i, { srt: text, label: manTracks[i].label || file.name.replace(/\.srt$/i, '') });
    };
    reader.readAsText(file);
  };

  const handleManSubmit = () => {
    setManError('');
    if (!manTitle.trim()) { setManError('Enter a title for this project.'); return; }
    const validTracks = manTracks.filter(t => t.srt.trim());
    if (!validTracks.length) { setManError('Provide SRT content for at least one track.'); return; }

    const tracks: YtTrack[] = validTracks.map((t, i) => ({
      lang: t.lang || `track${i}`,
      label: t.label.trim() || `Track ${i + 1}`,
      isAuto: false,
      srtContent: t.srt.trim(),
    }));

    const manVid = extractVideoId(manVideoUrl.trim()) || '';
    const id = manVid || `manual-${Date.now()}`;
    onProjectReady(buildProject(id, manVid, manTitle.trim(), tracks, manTargetLang));
  };

  // ── Render: loading ───────────────────────────────────────────────────────
  if (fetchStep === 'loading') {
    return <div className="yl-setup"><div className="yl-spinner">⏳ {loadingMsg}</div></div>;
  }

  // ── Render: main setup ────────────────────────────────────────────────────
  return (
    <div className="yl-setup">
      <div className="yl-setup-hero">
        <h1 className="yl-setup-title">🎓 YouTube Language Learner</h1>
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

      {/* Mode tabs */}
      <div className="yl-mode-tabs">
        <button
          className={`yl-mode-tab ${mode === 'fetch' ? 'yl-mode-tab-active' : ''}`}
          onClick={() => setMode('fetch')}
        >
          🔗 Fetch from YouTube
        </button>
        <button
          className={`yl-mode-tab ${mode === 'manual' ? 'yl-mode-tab-active' : ''}`}
          onClick={() => setMode('manual')}
        >
          📄 Manual Import
        </button>
      </div>

      {/* ── Fetch mode ─────────────────────────────────────────────────────── */}
      {mode === 'fetch' && (
        <div className="yl-setup-form">
          <label className="yl-label">YouTube URL or Video ID</label>
          <input
            className="yl-input"
            type="text"
            placeholder="https://www.youtube.com/watch?v=..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLoadUrl()}
            autoFocus
          />

          <label className="yl-label">Subtitles language</label>
          <select className="yl-select" value={subtitlesLang} onChange={e => setSubtitlesLang(e.target.value)}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          <label className="yl-label">Translate subtitles to</label>
          <select className="yl-select" value={targetLang} onChange={e => setTargetLang(e.target.value)}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          {fetchError && <p className="yl-error">{fetchError}</p>}

          <button className="yl-btn-primary yl-btn-full" onClick={handleLoadUrl}>
            Load Video →
          </button>
        </div>
      )}

      {/* ── Manual mode ────────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <div className="yl-setup-form yl-manual-form">
          <label className="yl-label">Project title <span className="yl-required">*</span></label>
          <input
            className="yl-input"
            type="text"
            placeholder="e.g. My Study Transcript"
            value={manTitle}
            onChange={e => setManTitle(e.target.value)}
            autoFocus
          />

          <label className="yl-label">YouTube URL (optional — links video to transcript)</label>
          <input
            className="yl-input"
            type="text"
            placeholder="https://www.youtube.com/watch?v=... (optional)"
            value={manVideoUrl}
            onChange={e => setManVideoUrl(e.target.value)}
          />

          <label className="yl-label">Translate subtitles to</label>
          <select className="yl-select" value={manTargetLang} onChange={e => setManTargetLang(e.target.value)}>
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>

          {/* Input mode tabs */}
          <div className="yl-srt-tabs">
            <button
              className={`yl-srt-tab ${manInputMode === 'paste' ? 'yl-srt-tab-active' : ''}`}
              onClick={() => setManInputMode('paste')}
              type="button"
            >
              ✏️ Paste SRT
            </button>
            <button
              className={`yl-srt-tab ${manInputMode === 'upload' ? 'yl-srt-tab-active' : ''}`}
              onClick={() => setManInputMode('upload')}
              type="button"
            >
              📁 Upload File
            </button>
          </div>

          {/* Tracks */}
          <div className="yl-manual-tracks">
            {manTracks.map((track, i) => (
              <div key={i} className="yl-track-card">
                <div className="yl-track-card-header">
                  <span className="yl-track-num">Track {i + 1}</span>
                  {manTracks.length > 1 && (
                    <button className="yl-btn-ghost yl-btn-sm yl-btn-danger" onClick={() => removeManTrack(i)} type="button">
                      ✕ Remove
                    </button>
                  )}
                </div>
                <div className="yl-track-meta">
                  <div className="yl-track-meta-field">
                    <label className="yl-label">Label</label>
                    <input
                      className="yl-input"
                      type="text"
                      placeholder="e.g. English, Spanish…"
                      value={track.label}
                      onChange={e => updateManTrack(i, { label: e.target.value })}
                    />
                  </div>
                  <div className="yl-track-meta-field">
                    <label className="yl-label">Language code</label>
                    <input
                      className="yl-input"
                      type="text"
                      placeholder="en, he, ar…"
                      value={track.lang}
                      onChange={e => updateManTrack(i, { lang: e.target.value })}
                    />
                  </div>
                </div>

                {manInputMode === 'paste' ? (
                  <>
                    <label className="yl-label">SRT content</label>
                    <textarea
                      className="yl-textarea"
                      placeholder={"1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n..."}
                      value={track.srt}
                      onChange={e => updateManTrack(i, { srt: e.target.value })}
                      rows={7}
                    />
                  </>
                ) : (
                  <div className="yl-file-upload">
                    <input
                      type="file"
                      accept=".srt,.txt"
                      ref={el => { fileRefs.current[i] = el; }}
                      style={{ display: 'none' }}
                      onChange={e => handleFileChange(i, e.target.files?.[0] ?? null)}
                    />
                    <button
                      className="yl-btn-secondary"
                      type="button"
                      onClick={() => fileRefs.current[i]?.click()}
                    >
                      📂 Choose .srt file
                    </button>
                    {track.srt ? (
                      <span className="yl-file-ok">✓ {track.srt.split('\n').length} lines loaded</span>
                    ) : (
                      <span className="yl-file-hint">No file selected</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="yl-btn-secondary" onClick={addManTrack} type="button">
            + Add another track
          </button>

          {manError && <p className="yl-error">{manError}</p>}

          <button className="yl-btn-primary yl-btn-full" onClick={handleManSubmit}>
            Open Transcript →
          </button>
        </div>
      )}
    </div>
  );
}
