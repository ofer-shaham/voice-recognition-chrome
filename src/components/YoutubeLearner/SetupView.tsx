import React, { useRef, useState } from 'react';
import { YtProject, YtTrack, ProjectConfig, AvailableLang } from './types';
import { LANG_OPTIONS, DEFAULT_TTS_RATE, DEFAULT_VISIBLE_LINES } from './constants';
import { extractVideoId, dedupeAvailLangs } from './utils';

interface Props {
  onProjectReady: (project: YtProject) => void;
  recentProject: YtProject | null;
  hasHistory?: boolean;
  onLoadRecent: () => void;
  onClearHistory?: () => void;
}

type Step = 'url' | 'langs';
type SubtitleService = 'plus' | 'api-js' | 'onrender';
type SetupMode = 'fetch' | 'manual';

interface ManualTrack {
  label: string;
  lang: string;
  srt: string;
  url: string;
}

function buildProject(
  id: string,
  videoId: string,
  title: string,
  tracks: YtTrack[],
  targetLang: string,
  subtitleService: SubtitleService
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

  return { id, videoId, title, createdAt: Date.now(), updatedAt: Date.now(), tracks, config, lastLine: 0, subtitleService };
}

export default function SetupView({ onProjectReady, recentProject, onLoadRecent }: Props) {
  const [mode, setMode] = useState<SetupMode>('fetch');
  const [step, setStep] = useState<Step>('url');

  // ── URL step ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=prSfxdmjNzE');
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState('');

  // ── Language selection step ──────────────────────────────────────────────
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [availLangs, setAvailLangs] = useState<AvailableLang[]>([]);
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());
  const [targetLang, setTargetLang] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [subtitleService, setSubtitleService] = useState<SubtitleService>('plus');
  const subtitleMethod = subtitleService === 'plus' ? '1' : subtitleService === 'api-js' ? '2' : '3';
  const [manualTitle, setManualTitle] = useState('');
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [manualTargetLang, setManualTargetLang] = useState('he');
  const [manualTracks, setManualTracks] = useState<ManualTrack[]>([{ label: '', lang: 'en', srt: '', url: '' }]);
  const [manualInputMode, setManualInputMode] = useState<'url' | 'paste' | 'upload'>('url');
  const [manualError, setManualError] = useState('');
  const [manualUrlLoading, setManualUrlLoading] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const serviceToggle = (
    <div className="yl-service-picker" role="group" aria-label="Subtitle service">
      <span className="yl-service-label">Subtitle service</span>
      <div className="yl-service-toggle">
        <button
          type="button"
          className={`yl-service-option ${subtitleService === 'plus' ? 'yl-service-option-active' : ''}`}
          onClick={() => setSubtitleService('plus')}
          aria-pressed={subtitleService === 'plus'}
        >
          youtube-transcript-plus
        </button>
        <button
          type="button"
          className={`yl-service-option ${subtitleService === 'api-js' ? 'yl-service-option-active' : ''}`}
          onClick={() => setSubtitleService('api-js')}
          aria-pressed={subtitleService === 'api-js'}
        >
          youtube-transcript-api-js
        </button>
        <button
          type="button"
          className={`yl-service-option ${subtitleService === 'onrender' ? 'yl-service-option-active' : ''}`}
          onClick={() => setSubtitleService('onrender')}
          aria-pressed={subtitleService === 'onrender'}
        >
          OnRender subtitle service
        </button>
      </div>
      <span className="yl-service-help">Choose which subtitle provider fetches the selected tracks.</span>
    </div>
  );

  const handleFindLanguages = async () => {
    setFindError('');
    const vid = extractVideoId(url.trim());
    if (!vid) { setFindError('Could not extract a video ID from that URL.'); return; }
    setFindLoading(true);
    try {
      const serviceQuery = subtitleService === 'onrender' ? '&service=onrender' : '';
      const res = await fetch(`/api/transcript/languages?videoId=${encodeURIComponent(vid)}${serviceQuery}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const langs = dedupeAvailLangs<AvailableLang>((data.availableLanguages || []).map((l: any): AvailableLang => ({
        languageCode: l.languageCode || String(l),
        name: l.name || l.languageCode || String(l),
        isAutoGenerated: !!l.isAutoGenerated,
      })));
      if (!langs.length) throw new Error('No subtitle tracks found for this video.');
      setVideoId(vid);
      setVideoTitle(data.videoDetails?.title || null);
      setAvailLangs(langs);
      setSelectedLangs(new Set([langs[0].languageCode]));
      setStep('langs');
    } catch (e: any) {
      setFindError(e.message || 'Failed to fetch available languages');
    }
    setFindLoading(false);
  };

  const toggleLang = (code: string) => {
    setSelectedLangs(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const handleFetchSelected = async () => {
    setFetchError('');
    if (!selectedLangs.size) { setFetchError('Select at least one language track.'); return; }
    if (!targetLang.trim()) { setFetchError('Enter a target language to translate to.'); return; }
    setFetchLoading(true);
    try {
      const chosen = availLangs.filter(l => selectedLangs.has(l.languageCode));
      const tracks: YtTrack[] = [];
      for (const lang of chosen) {
        const langCode = lang.languageCode.split('-')[0];
        const res = await fetch(`/api/srt?videoId=${encodeURIComponent(videoId)}&lang=${langCode}&method=${subtitleMethod}`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const srtContent = await res.text();
        tracks.push({ lang: lang.languageCode, label: lang.name, isAuto: lang.isAutoGenerated, srtContent });
      }
      onProjectReady(buildProject(videoId, videoId, videoTitle || videoId, tracks, targetLang.trim(), subtitleService));
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

  const updateManualTrack = (index: number, patch: Partial<ManualTrack>) => {
    setManualTracks(prev => prev.map((track, i) => i === index ? { ...track, ...patch } : track));
  };

  const handleManualFile = (index: number, file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      const srt = typeof event.target?.result === 'string' ? event.target.result : '';
      updateManualTrack(index, {
        srt,
        label: manualTracks[index].label || file.name.replace(/\.(srt|txt)$/i, ''),
      });
    };
    reader.readAsText(file);
  };

  const handleManualUrl = async (index: number) => {
    const sourceUrl = manualTracks[index].url.trim();
    if (!sourceUrl) {
      setManualError(`Enter a subtitle URL for Track ${index + 1}.`);
      return;
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      setManualError('Enter a valid public http:// or https:// subtitle URL.');
      return;
    }

    setManualError('');
    setManualUrlLoading(index);
    try {
      const response = await fetch(`/api/srt-url?url=${encodeURIComponent(parsedUrl.toString())}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      const srt = await response.text();
      if (!srt.trim()) throw new Error('The URL returned an empty file.');
      const fileName = parsedUrl.pathname.split('/').filter(Boolean).pop() || '';
      updateManualTrack(index, {
        srt,
        label: manualTracks[index].label || fileName.replace(/\.(srt|vtt|txt)$/i, ''),
      });
    } catch (e: any) {
      setManualError(`Track ${index + 1}: ${e.message || 'Could not fetch subtitle URL.'}`);
    } finally {
      setManualUrlLoading(null);
    }
  };

  const handleManualSubmit = () => {
    setManualError('');
    if (!manualTitle.trim()) { setManualError('Enter a title for this project.'); return; }
    const validTracks = manualTracks.filter(track => track.srt.trim());
    if (!validTracks.length) { setManualError('Provide SRT content for at least one track.'); return; }

    const tracks: YtTrack[] = validTracks.map((track, index) => ({
      lang: track.lang.trim() || `track${index + 1}`,
      label: track.label.trim() || `Track ${index + 1}`,
      isAuto: false,
      srtContent: track.srt.trim(),
    }));
    const manualVideoId = extractVideoId(manualVideoUrl.trim()) || '';
    const id = manualVideoId || `manual-${Date.now()}`;
    onProjectReady(buildProject(id, manualVideoId, manualTitle.trim(), tracks, manualTargetLang.trim(), 'plus'));
  };

  // ── Render: language selection ───────────────────────────────────────────
  if (step === 'langs') {
    return (
      <div className="yl-setup">
        <div className="yl-setup-hero">
          <h1 className="yl-setup-title">🎓 YouTube Language Learner</h1>
          {videoTitle && <p className="yl-setup-subtitle">{videoTitle}</p>}
        </div>

        <div className="yl-setup-form">
          <label className="yl-label">Select subtitle track(s) to fetch</label>
          {serviceToggle}
          <div className="yl-lang-chips">
            {availLangs.map(l => (
              <button
                key={l.languageCode}
                type="button"
                className={`yl-lang-chip ${selectedLangs.has(l.languageCode) ? 'yl-lang-chip-loaded' : 'yl-lang-chip-add'}`}
                onClick={() => toggleLang(l.languageCode)}
              >
                {selectedLangs.has(l.languageCode) ? '✓' : '+'} {l.name}
                {l.isAutoGenerated && <span className="yl-auto-badge">auto</span>}
              </button>
            ))}
          </div>

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
            <button className="yl-btn-primary yl-btn-full" onClick={handleFetchSelected} disabled={fetchLoading}>
              {fetchLoading ? 'Fetching…' : 'Load Video →'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: URL step ──────────────────────────────────────────────────────
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

      <div className="yl-mode-tabs" role="tablist" aria-label="Subtitle input method">
        <button type="button" role="tab" aria-selected={mode === 'fetch'} className={`yl-mode-tab ${mode === 'fetch' ? 'yl-mode-tab-active' : ''}`} onClick={() => setMode('fetch')}>
          🔗 Fetch from YouTube
        </button>
        <button type="button" role="tab" aria-selected={mode === 'manual'} className={`yl-mode-tab ${mode === 'manual' ? 'yl-mode-tab-active' : ''}`} onClick={() => setMode('manual')}>
          📄 Manual Import
        </button>
      </div>

      {mode === 'fetch' ? <div className="yl-setup-form">
        <label className="yl-label">YouTube URL or Video ID</label>
        <input
          className="yl-input"
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFindLanguages()}
          autoFocus
        />

        {serviceToggle}

        {findError && <p className="yl-error">{findError}</p>}

        <button className="yl-btn-primary yl-btn-full" onClick={handleFindLanguages} disabled={findLoading || !url.trim()}>
          {findLoading ? 'Finding subtitle tracks…' : 'Find subtitle tracks →'}
        </button>
      </div> : (
        <div className="yl-setup-form yl-manual-form">
          <label className="yl-label">Project title <span className="yl-required">*</span></label>
          <input className="yl-input" type="text" placeholder="e.g. My Study Transcript" value={manualTitle} onChange={e => setManualTitle(e.target.value)} autoFocus />

          <label className="yl-label">YouTube URL (optional — links video to transcript)</label>
          <input className="yl-input" type="text" placeholder="https://www.youtube.com/watch?v=... (optional)" value={manualVideoUrl} onChange={e => setManualVideoUrl(e.target.value)} />

          <label className="yl-label">Translate subtitles to</label>
          <input className="yl-input" type="text" list="yl-manual-lang-suggestions" placeholder="en, he, ar…" value={manualTargetLang} onChange={e => setManualTargetLang(e.target.value)} />
          <datalist id="yl-manual-lang-suggestions">
            {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
          </datalist>

           <div className="yl-srt-tabs">
             <button type="button" className={`yl-srt-tab ${manualInputMode === 'url' ? 'yl-srt-tab-active' : ''}`} onClick={() => setManualInputMode('url')}>🔗 Fetch SRT from URL</button>
            <button type="button" className={`yl-srt-tab ${manualInputMode === 'paste' ? 'yl-srt-tab-active' : ''}`} onClick={() => setManualInputMode('paste')}>✏️ Paste SRT</button>
            <button type="button" className={`yl-srt-tab ${manualInputMode === 'upload' ? 'yl-srt-tab-active' : ''}`} onClick={() => setManualInputMode('upload')}>📁 Upload File</button>
          </div>
           <p className="yl-input-method-hint">Choose one way to provide the SRT for each track.</p>

          <div className="yl-manual-tracks">
          {manualTracks.map((track, index) => (
              <div className="yl-track-card" key={index}>
                <div className="yl-track-card-header">
                  <span className="yl-track-num">Track {index + 1}</span>
                  {manualTracks.length > 1 && <button className="yl-btn-ghost yl-btn-sm yl-btn-danger" type="button" onClick={() => setManualTracks(prev => prev.filter((_, i) => i !== index))}>✕ Remove</button>}
                </div>
                <div className="yl-track-meta">
                  <div className="yl-track-meta-field">
                    <label className="yl-label">Label</label>
                    <input className="yl-input" type="text" placeholder="English, Spanish…" value={track.label} onChange={e => updateManualTrack(index, { label: e.target.value })} />
                  </div>
                  <div className="yl-track-meta-field">
                    <label className="yl-label">Language code</label>
                    <input className="yl-input" type="text" placeholder="en, he, ar…" value={track.lang} onChange={e => updateManualTrack(index, { lang: e.target.value })} />
                  </div>
                </div>
                {manualInputMode === 'url' ? (
                  <div className="yl-url-fetch">
                    <label className="yl-label">Public subtitle URL</label>
                    <div className="yl-url-fetch-row">
                      <input
                        className="yl-input"
                        type="url"
                        placeholder="https://example.com/lesson.srt"
                        value={track.url}
                        onChange={e => updateManualTrack(index, { url: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleManualUrl(index)}
                      />
                      <button className="yl-btn-secondary" type="button" onClick={() => handleManualUrl(index)} disabled={manualUrlLoading !== null}>
                        {manualUrlLoading === index ? 'Fetching…' : 'Fetch'}
                      </button>
                    </div>
                    <span className={track.srt ? 'yl-file-ok' : 'yl-file-hint'}>
                      {track.srt ? `✓ ${track.srt.split('\n').length} lines loaded` : 'Fetch a public .srt, .vtt, or timestamped-text file'}
                    </span>
                  </div>
                ) : manualInputMode === 'paste' ? (
                  <>
                    <label className="yl-label">SRT content</label>
                    <textarea className="yl-textarea" placeholder={'1\n00:00:01,000 --> 00:00:04,000\nHello world'} value={track.srt} onChange={e => updateManualTrack(index, { srt: e.target.value })} rows={7} />
                  </>
                ) : (
                  <div className="yl-file-upload">
                    <input ref={element => { fileRefs.current[index] = element; }} type="file" accept=".srt,.txt" hidden onChange={e => handleManualFile(index, e.target.files?.[0] || null)} />
                    <button className="yl-btn-secondary" type="button" onClick={() => fileRefs.current[index]?.click()}>📂 Choose .srt file</button>
                    <span className={track.srt ? 'yl-file-ok' : 'yl-file-hint'}>{track.srt ? `✓ ${track.srt.split('\n').length} lines loaded` : 'No file selected'}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
           <button className="yl-btn-secondary" type="button" onClick={() => setManualTracks(prev => [...prev, { label: '', lang: 'en', srt: '', url: '' }])}>+ Add another track</button>
          {manualError && <p className="yl-error">{manualError}</p>}
          <button className="yl-btn-primary yl-btn-full" type="button" onClick={handleManualSubmit}>Open Transcript →</button>
        </div>
      )}
    </div>
  );
}
