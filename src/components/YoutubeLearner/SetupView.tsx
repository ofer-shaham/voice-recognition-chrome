import React, { useRef, useState } from 'react';
import {
  YtProject,
  YtTrack,
  ProjectConfig,
  AvailableLang,
  YoutubeTheme,
  SubtitleService,
  SUBTITLE_SERVICE_INFO,
} from './types';
import { LANG_OPTIONS, DEFAULT_TTS_RATE, DEFAULT_VISIBLE_LINES } from './constants';
import { extractVideoId, dedupeAvailLangs } from './utils';
import { downloadProject, parseProjectFile } from './projectTransfer';

interface Props {
  onProjectReady: (project: YtProject) => void;
  onProjectFetched?: (project: YtProject) => void;
  recentProject: YtProject | null;
  projects: YtProject[];
  hasHistory?: boolean;
  onLoadRecent: () => void;
  onLoadProject: (project: YtProject) => void;
  onDeleteProject: (id: string) => void;
  onClearHistory?: () => void;
}

type Step = 'url' | 'langs';
type SetupMode = 'fetch' | 'manual';
type ProxyMode = 'direct' | 'http' | 'tor';

interface ManualTrack {
  label: string;
  lang: string;
  srt: string;
  url: string;
}

const INVIDIOUS_DEMO_URL = 'https://invidious.nerdvpn.de/companion/api/v1/captions/lXCAHAJR2-Q?check=X-ce5seVANHkTyqeXaj2WyRAlxP7oYXDK_Hf49yQGLw=';

function toSrtTimedTextUrl(value: string): string {
  try {
    const parsed = new URL(value.trim());
    if (!parsed.pathname.endsWith('/api/timedtext')) return '';
    parsed.searchParams.set('fmt', 'srt');
    return parsed.toString();
  } catch {
    return '';
  }
}

function parseInvidiousCaptionsUrl(value: string): { videoId: string } | null {
  try {
    const parsed = new URL(value.trim());
    const match = parsed.pathname.match(/\/api\/v1\/captions\/([^/]+)$/);
    if (
      !match ||
      !parsed.pathname.includes('/api/v1/') ||
      !/^[A-Za-z0-9_-]{11}$/.test(match[1]) ||
      !parsed.searchParams.get('check')
    ) return null;
    return { videoId: decodeURIComponent(match[1]) };
  } catch {
    return null;
  }
}

function buildProject(
  id: string,
  videoId: string,
  title: string,
  description: string,
  tracks: YtTrack[],
  targetLang: string,
  subtitleService: SubtitleService,
  alternateYoutubeUrl = '',
  subtitleProxyUrl = '',
): YtProject {
  const colOrder: string[] = [...tracks.map(t => `track:${t.lang}`), 'video'];
  const colSettings: ProjectConfig['colSettings'] = {};
  tracks.forEach((t, i) => {
    colSettings[`track:${t.lang}`] = { visible: true, playOrder: i + 1, ttsRate: DEFAULT_TTS_RATE };
  });
  colSettings['video'] = { visible: !!videoId, playOrder: tracks.length + 1, ttsRate: DEFAULT_TTS_RATE };

  const config: ProjectConfig = {
    targetLang: '',
    translationTargets: [],
    translationSource: `track:${tracks[0].lang}`,
    colOrder,
    colSettings,
    visibleLines: DEFAULT_VISIBLE_LINES,
  };

  return {
    id, videoId, title, description, createdAt: Date.now(), updatedAt: Date.now(),
    tracks, config, lastLine: 0, lastTime: 0, subtitleService,
    alternateYoutubeUrl: alternateYoutubeUrl.trim() || undefined,
    subtitleProxyUrl: subtitleProxyUrl.trim() || undefined,
  };
}

interface SetupProps {
  onProjectReady: (project: YtProject) => void;
  onProjectFetched?: (project: YtProject) => void;
  recentProject: YtProject | null;
  projects: YtProject[];
  hasHistory?: boolean;
  onLoadRecent: () => void;
  onLoadProject: (project: YtProject) => void;
  onDeleteProject: (id: string) => void;
  onClearHistory?: () => void;
  theme: YoutubeTheme;
  onThemeChange: (theme: YoutubeTheme) => void;
}

export default function SetupView({ onProjectReady, onProjectFetched, recentProject, projects, onLoadRecent, onLoadProject, onDeleteProject, theme, onThemeChange }: SetupProps) {
  const [mode, setMode] = useState<SetupMode>('fetch');
  const [step, setStep] = useState<Step>('url');

  const getSharedSetupUrl = () => {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    return params.get('url') || params.get('u') || params.get('videoUrl') || params.get('v') || '';
  };

  const getSharedSetupMethod = (): SubtitleService | null => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const method = params.get('m') || params.get('method') || params.get('service');
    return method && ['plus', 'api-js', 'onrender', 'iframe', 'invidious'].includes(method)
      ? (method as SubtitleService)
      : null;
  };

  // ── URL step ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState(() => {
    const sharedUrl = getSharedSetupUrl();
    return sharedUrl || 'https://www.youtube.com/watch?v=prSfxdmjNzE';
  });
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState('');
  const [capturedRequestUrl, setCapturedRequestUrl] = useState('');
  const [capturedLoading, setCapturedLoading] = useState(false);
  const replacedRequestUrl = toSrtTimedTextUrl(capturedRequestUrl);
  const [invidiousCaptionsUrl, setInvidiousCaptionsUrl] = useState('');

  // ── Language selection step ──────────────────────────────────────────────
  const [videoId, setVideoId] = useState('');
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoDescription, setVideoDescription] = useState('');
  const [availLangs, setAvailLangs] = useState<AvailableLang[]>([]);
  const [languageDiscoveryFallback, setLanguageDiscoveryFallback] = useState(false);
  const [selectedLangs, setSelectedLangs] = useState<Set<string>>(new Set());
  const [targetLang, setTargetLang] = useState('');
  const [fetchLoading, setFetchLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedProject, setFetchedProject] = useState<YtProject | null>(null);
  const [subtitleService, setSubtitleService] = useState<SubtitleService>('plus');
  const subtitleMethod = subtitleService === 'plus' ? '1' : subtitleService === 'api-js' ? '2' : '3';
  const [alternateYoutubeUrl, setAlternateYoutubeUrl] = useState('');
  const [subtitleProxyUrl, setSubtitleProxyUrl] = useState('');
  const [proxyMode, setProxyMode] = useState<ProxyMode>('direct');
  const [manualTitle, setManualTitle] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualVideoUrl, setManualVideoUrl] = useState('');
  const [manualMetadataLoading, setManualMetadataLoading] = useState(false);
  const [manualMetadataId, setManualMetadataId] = useState('');
  const [manualTargetLang, setManualTargetLang] = useState('');
  const [manualTracks, setManualTracks] = useState<ManualTrack[]>([{ label: '', lang: 'en', srt: '', url: '' }]);
  const [manualInputMode, setManualInputMode] = useState<'url' | 'paste' | 'upload'>('url');
  const [manualError, setManualError] = useState('');
  const [manualUrlLoading, setManualUrlLoading] = useState<number | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const projectFileRef = useRef<HTMLInputElement | null>(null);
  const previewVideoId = extractVideoId(url.trim());
  const subtitleServiceInfo = SUBTITLE_SERVICE_INFO[subtitleService];

  const buildSetupShareUrl = () => {
    const params = new URLSearchParams();
    if (url.trim()) params.set('url', url.trim());
    params.set('m', subtitleService);

    const sharePath = window.location.pathname.startsWith('/youtube2/') ? '/youtube2/setup' : '/youtube/setup';
    const shareUrl = new URL(sharePath, window.location.origin);
    shareUrl.search = params.toString();
    return shareUrl.toString();
  };

  React.useEffect(() => {
    const sharedUrl = getSharedSetupUrl();
    const sharedMethod = getSharedSetupMethod();
    const sharedVideoId = sharedUrl && /^[\w-]{11}$/.test(sharedUrl.trim()) ? sharedUrl.trim() : extractVideoId(sharedUrl || '');

    if (sharedMethod) {
      setSubtitleService(sharedMethod);
    }

    if (sharedUrl) {
      if (parseInvidiousCaptionsUrl(sharedUrl)) {
        setSubtitleService('invidious');
        setInvidiousCaptionsUrl('');
      }
      setUrl(sharedUrl);
      handleFindLanguages(sharedUrl);
      return;
    }

    if (sharedVideoId) {
      setUrl(`https://www.youtube.com/watch?v=${sharedVideoId}`);
      handleFindLanguages(`https://www.youtube.com/watch?v=${sharedVideoId}`);
    }
  }, []);

  const serviceToggle = (
    <div className="yl-service-picker" role="group" aria-label="Subtitle fetch provider">
      <span className="yl-service-label">Fetch captions with</span>
      <div className="yl-service-toggle">
        {([
          ['plus', 'Transcript Plus'],
          ['api-js', 'Transcript API.js'],
          ['onrender', 'Hosted captions'],
          ['iframe', 'YouTube player'],
          ['invidious', 'Invidious'],
        ] as const).map(([value, label]) => (
          <button key={value} type="button"
            className={`yl-service-option ${subtitleService === value ? 'yl-service-option-active' : ''}`}
            onClick={() => setSubtitleService(value)} aria-pressed={subtitleService === value}>
            <span>{label}{value === 'plus' && <span className="yl-default-badge">default</span>}</span>
            <small>{SUBTITLE_SERVICE_INFO[value].library}</small>
          </button>
        ))}
      </div>
      {subtitleService === 'invidious' && (
        <label className="yl-service-extra">
          <span>Invidious captions URL</span>
          <input
            className="yl-input"
            type="url"
            placeholder="https://invidious.nerdvpn.de/companion/api/v1/captions/VIDEO_ID?check=check-id"
            value={invidiousCaptionsUrl}
            onChange={e => setInvidiousCaptionsUrl(e.target.value)}
          />
        </label>
      )}
      <label className={`yl-service-extra ${subtitleServiceInfo.supportsAlternate ? '' : 'yl-service-extra-disabled'}`}>
        <span>
          Alternate YouTube / Invidious host(s) <span className="yl-optional">(optional)</span>
          {!subtitleServiceInfo.supportsAlternate && <small className="yl-service-disabled-note">not supported by this library</small>}
        </span>
        <input
          className="yl-input"
          type="text"
          placeholder="https://yewtu.be, https://invidious.io"
          value={alternateYoutubeUrl}
          onChange={e => setAlternateYoutubeUrl(e.target.value)}
          disabled={!subtitleServiceInfo.supportsAlternate}
          title={subtitleServiceInfo.supportsAlternate ? undefined : `Not supported by ${subtitleServiceInfo.library}`}
        />
      </label>
      <label className={`yl-service-extra ${subtitleServiceInfo.supportsProxy ? '' : 'yl-service-extra-disabled'}`}>
        <span>
          Network route <span className="yl-optional">(optional)</span>
          {!subtitleServiceInfo.supportsProxy && <small className="yl-service-disabled-note">not supported by this library</small>}
        </span>
        <select
          className="yl-input"
          value={proxyMode}
          onChange={e => {
            const next = e.target.value as ProxyMode;
            setProxyMode(next);
            if (next === 'tor' && !subtitleProxyUrl) setSubtitleProxyUrl('http://127.0.0.1:8118');
            if (next === 'direct') setSubtitleProxyUrl('');
          }}
          disabled={!subtitleServiceInfo.supportsProxy}
        >
          <option value="direct">Direct connection</option>
          <option value="http">HTTP / HTTPS proxy</option>
          <option value="tor">Tor via local HTTP bridge</option>
        </select>
        <input
          className="yl-input"
          type="url"
          placeholder={proxyMode === 'tor' ? 'http://127.0.0.1:8118' : 'http://proxy.example:8080'}
          value={subtitleProxyUrl}
          onChange={e => setSubtitleProxyUrl(e.target.value)}
          disabled={!subtitleServiceInfo.supportsProxy}
          title={subtitleServiceInfo.supportsProxy ? undefined : `Not supported by ${subtitleServiceInfo.library}`}
        />
        {subtitleServiceInfo.supportsProxy && proxyMode === 'tor' && (
          <small className="yl-proxy-note">Requires Tor plus an HTTP bridge such as Privoxy on port 8118. The app does not provide a public proxy.</small>
        )}
      </label>
      <span className="yl-service-help">
        {subtitleService === 'iframe'
          ? 'Open the player below, turn on CC, and inspect the caption request in DevTools.'
          : `${subtitleServiceInfo.library} is selected. Options unavailable for this library are disabled.`}
      </span>
    </div>
  );

  const handleProjectImport = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        onProjectReady(parseProjectFile(String(event.target?.result || '')));
      } catch (error: any) {
        setFindError(error.message || 'Could not import that project file.');
      }
    };
    reader.readAsText(file);
  };

  const fetchManualVideoMetadata = async () => {
    const id = extractVideoId(manualVideoUrl.trim());
    if (!id || id === manualMetadataId) return;
    setManualMetadataLoading(true);
    try {
      const res = await fetch(`/api/transcript/languages?videoId=${encodeURIComponent(id)}`);
      if (!res.ok) return;
      const data = await res.json();
      setManualMetadataId(id);
      if (data.videoDetails?.title && !manualTitle.trim()) setManualTitle(data.videoDetails.title);
      if (data.videoDetails?.description && !manualDescription.trim()) setManualDescription(data.videoDetails.description);
    } catch {
      // Metadata is supplemental; manual subtitle import remains available.
    } finally {
      setManualMetadataLoading(false);
    }
  };

  const handleFindLanguages = async (inputUrl = url) => {
    setFindError('');
    setFetchedProject(null);
    const inputInvidiousUrl = parseInvidiousCaptionsUrl(inputUrl);
    if (inputInvidiousUrl || subtitleService === 'invidious') {
      const sourceUrl = inputInvidiousUrl ? inputUrl.trim() : invidiousCaptionsUrl.trim();
      setFindLoading(true);
      try {
        const response = await fetch(`/api/invidious-caption?url=${encodeURIComponent(sourceUrl)}`);
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
        const subtitleUrl = String(body.subtitleUrl || '');
        if (!subtitleUrl) throw new Error('Invidious did not return a subtitle URL.');
        setInvidiousCaptionsUrl(subtitleUrl);
        const finalResponse = await fetch(`/api/srt-url?url=${encodeURIComponent(subtitleUrl)}`);
        if (!finalResponse.ok) {
          const finalBody = await finalResponse.json().catch(() => ({}));
          throw new Error(finalBody.error || `Subtitle fetch failed (HTTP ${finalResponse.status})`);
        }
        const subtitleText = await finalResponse.text();
        if (!subtitleText.trim()) throw new Error('The final Invidious subtitle URL returned an empty file.');
        const parsed = new URL(subtitleUrl);
        const invidiousVideoId = inputInvidiousUrl?.videoId || 'invidious';
        const label = parsed.searchParams.get('label') || 'Invidious captions';
        const project = buildProject(
          invidiousVideoId,
          invidiousVideoId,
          `Invidious video ${invidiousVideoId}`,
          'Subtitle imported from Invidious.',
          [{ lang: 'und', label, isAuto: false, srtContent: subtitleText }],
          targetLang.trim(),
          'invidious',
        );
        setFetchedProject(project);
        onProjectFetched?.(project);
      } catch (e: any) {
        setFindError(e.message || 'Could not fetch Invidious captions.');
      } finally {
        setFindLoading(false);
      }
      return;
    }
    const vid = extractVideoId(url.trim());
    if (!vid) { setFindError('Could not extract a video ID from that URL.'); return; }
    setFindLoading(true);
    try {
      const sourceQuery = new URLSearchParams();
      if (subtitleServiceInfo.supportsAlternate && alternateYoutubeUrl.trim()) {
        sourceQuery.set('instanceUrl', alternateYoutubeUrl.trim());
      }
      if (subtitleServiceInfo.supportsProxy && subtitleProxyUrl.trim()) {
        sourceQuery.set('proxyUrl', subtitleProxyUrl.trim());
      }
      if (subtitleService === 'onrender') {
        sourceQuery.set('service', 'onrender');
      } else if (subtitleService !== 'iframe') {
        sourceQuery.set('method', subtitleMethod);
      }
      const res = await fetch(`/api/transcript/languages?videoId=${encodeURIComponent(vid)}${sourceQuery.toString() ? `&${sourceQuery}` : ''}`);
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
      // Some videos expose metadata through YouTube's player API but omit the
      // caption list. The transcript providers can still resolve a requested
      // language, so let the user continue instead of blocking at discovery.
      const usableLangs = langs.length ? langs : LANG_OPTIONS.map(l => ({
        languageCode: l.code,
        name: `${l.label} · language-code request`,
        isAutoGenerated: false,
      }));
      setVideoId(vid);
      setVideoTitle(data.videoDetails?.title || `YouTube video ${vid}`);
      setVideoDescription(data.videoDetails?.description || `YouTube video transcript for ${vid}`);
      setAvailLangs(usableLangs);
      setLanguageDiscoveryFallback(!langs.length);
      setSelectedLangs(new Set([usableLangs[0].languageCode]));
      setStep('langs');
    } catch (e: any) {
      setFindError(e.message || 'Failed to fetch available languages');
    }
    setFindLoading(false);
  };

  const handleCapturedRequest = async () => {
    if (!previewVideoId || !replacedRequestUrl) return;
    setFindError('');
    setCapturedLoading(true);
    try {
      const response = await fetch(`/api/timedtext?url=${encodeURIComponent(replacedRequestUrl)}`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Could not fetch the captured caption request (HTTP ${response.status})`);
      }
      const srtContent = await response.text();
      if (!srtContent.trim()) throw new Error('The converted SRT response was empty.');
      const requestUrl = new URL(replacedRequestUrl);
      const lang = requestUrl.searchParams.get('lang') || 'en';
      const isAuto = requestUrl.searchParams.get('kind') === 'asr' || requestUrl.searchParams.get('caps') === 'asr';
      onProjectReady(buildProject(
        previewVideoId,
        previewVideoId,
        `YouTube video ${previewVideoId}`,
        `Subtitle imported from the YouTube player (${lang})`,
        [{ lang, label: `${lang}${isAuto ? ' · auto-generated' : ''}`, isAuto, srtContent }],
        'he',
        'iframe',
      ));
    } catch (e: any) {
      setFindError(e.message || 'Could not convert the captured caption request.');
    } finally {
      setCapturedLoading(false);
    }
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
    setFetchLoading(true);
    try {
      const chosen = availLangs.filter(l => selectedLangs.has(l.languageCode));
      const tracks: YtTrack[] = [];
      const sourceQuery = new URLSearchParams();
      if (subtitleServiceInfo.supportsAlternate && alternateYoutubeUrl.trim()) {
        sourceQuery.set('instanceUrl', alternateYoutubeUrl.trim());
      }
      if (subtitleServiceInfo.supportsProxy && subtitleProxyUrl.trim()) {
        sourceQuery.set('proxyUrl', subtitleProxyUrl.trim());
      }
      const query = sourceQuery.toString();
      for (const lang of chosen) {
        const langCode = lang.languageCode.split('-')[0];
        const methodQuery = subtitleService === 'iframe' ? '' : `&method=${subtitleMethod}`;
        const trackUrl = lang.subtitleUrl
          ? `/api/srt-url?url=${encodeURIComponent(lang.subtitleUrl)}`
          : `/api/srt?videoId=${encodeURIComponent(videoId)}&lang=${encodeURIComponent(langCode)}${methodQuery}${query ? `&${query}` : ''}`;
        const res = await fetch(trackUrl);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || `HTTP ${res.status}`);
        }
        const srtContent = await res.text();
        tracks.push({ lang: lang.languageCode, label: lang.name, isAuto: lang.isAutoGenerated, srtContent });
      }
      // Keep the selected source settings on the project so additional tracks
      // use the same alternate host/proxy from the player settings.
      onProjectReady(buildProject(videoId, videoId, videoTitle || `YouTube video ${videoId}`, videoDescription || `YouTube video transcript for ${videoId}`, tracks, targetLang.trim(), subtitleService, alternateYoutubeUrl, subtitleProxyUrl));
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
    onProjectReady(buildProject(id, manualVideoId, manualTitle.trim(), manualDescription.trim() || `Manual transcript project${manualVideoId ? ` for ${manualVideoId}` : ''}`, tracks, manualTargetLang.trim(), 'plus'));
  };

  // ── Render: language selection ───────────────────────────────────────────
  if (step === 'langs') {
    return (
      <div className={`yl-setup yl-theme-${theme}`}>
        <div className="yl-setup-hero">
          <h1 className="yl-setup-title">🎓 YouTube Language Learner</h1>
          {videoTitle && <p className="yl-setup-subtitle">{videoTitle}</p>}
          <label className="yl-theme-control">
            Theme
            <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
              <option value="light">Light</option>
              <option value="blue">Blue</option>
              <option value="dark">Dark</option>
            </select>
          </label>
        </div>

        <div className="yl-setup-form">
          <label className="yl-label">Select subtitle track(s) to fetch</label>
          {serviceToggle}
          {languageDiscoveryFallback && (
            <p className="yl-fetch-note">
              YouTube did not return a confirmed track list. These are language-code requests; the selected subtitle provider will fetch the requested caption language directly.
            </p>
          )}
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

          <label className="yl-label">Translate subtitle text to <span className="yl-optional">(optional — Google Translate, on demand)</span></label>
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
    <div className={`yl-setup yl-theme-${theme}`}>
      <div className="yl-setup-hero">
        <h1 className="yl-setup-title">🎓 YouTube Language Learner</h1>
        <p className="yl-setup-subtitle">
          Watch YouTube videos with synchronized multi-language transcripts and TTS playback.
        </p>
        <label className="yl-theme-control">
          Theme
          <select className="yl-theme-select" value={theme} onChange={e => onThemeChange(e.target.value as YoutubeTheme)}>
            <option value="light">Light</option>
            <option value="blue">Blue</option>
            <option value="dark">Dark</option>
          </select>
        </label>
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

      {projects.length > 0 && (
        <div className="yl-projects-card">
          <div className="yl-projects-header">
            <div>
              <div className="yl-recent-label">Your library</div>
              <h2 className="yl-projects-title">Saved YouTube projects</h2>
            </div>
            <span className="yl-project-count">{projects.length}</span>
          </div>
          <div className="yl-project-actions">
            {recentProject && (
              <button type="button" className="yl-btn-secondary" onClick={() => downloadProject(recentProject)}>
                Export recent
              </button>
            )}
          </div>
          <div className="yl-project-list">
            {projects.map(project => (
              <div className="yl-project-row" key={project.id}>
                <button type="button" className="yl-project-load" onClick={() => onLoadProject(project)}>
                  <span className="yl-project-name">{project.title}</span>
                  <span className="yl-project-meta">
                    {project.videoId ? `YouTube · ${project.videoId}` : 'Manual transcript'}
                    {project.tracks.length > 0 && ` · ${project.tracks.length} track${project.tracks.length === 1 ? '' : 's'}`}
                  </span>
                </button>
                <button type="button" className="yl-btn-ghost yl-btn-sm" onClick={() => downloadProject(project)} title="Export project">
                  Export
                </button>
                <button
                  type="button"
                  className="yl-btn-ghost yl-btn-sm yl-btn-danger"
                  aria-label={`Delete ${project.title}`}
                  onClick={() => onDeleteProject(project.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="yl-project-actions yl-import-project-action">
        <input
          ref={projectFileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={e => {
            handleProjectImport(e.target.files?.[0] || null);
            e.currentTarget.value = '';
          }}
        />
        <button type="button" className="yl-btn-secondary" onClick={() => projectFileRef.current?.click()}>
          Import YouTube project
        </button>
        <span className="yl-input-method-hint">Load a previously exported project file.</span>
      </div>

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
          ref={urlInputRef}
          className="yl-input"
          type="text"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={e => setUrl(e.target.value)}
          onPaste={e => {
            const pastedValue = e.clipboardData.getData('text');
            if (!parseInvidiousCaptionsUrl(pastedValue)) return;
            e.preventDefault();
            setUrl(pastedValue);
            setSubtitleService('invidious');
            void handleFindLanguages(pastedValue);
          }}
          onKeyDown={e => e.key === 'Enter' && handleFindLanguages()}
          autoFocus
        />
        <button
          type="button"
          className="yl-btn-secondary"
          onClick={() => {
            setUrl(INVIDIOUS_DEMO_URL);
            setSubtitleService('invidious');
            setFindError('');
            setFetchedProject(null);
            urlInputRef.current?.focus();
          }}
        >
          Fill Invidious demo URL
        </button>
        <button
          type="button"
          className="yl-btn-ghost"
          onClick={async () => {
            const shareUrl = buildSetupShareUrl();
            try {
              await navigator.clipboard.writeText(shareUrl);
            } catch {
              window.prompt('Copy this URL:', shareUrl);
            }
          }}
        >
          Share setup URL
        </button>

        {serviceToggle}

        {subtitleService === 'iframe' && previewVideoId && (
          <div className="yl-caption-preview">
            <div className="yl-caption-preview-copy">
              <strong>Use the YouTube player</strong>
              <span>Start DevTools Network recording, click CC in the player, then choose Continue below. YouTube’s caption request will appear in the network log.</span>
            </div>
            <iframe
              className="yl-caption-preview-frame"
              src={`https://www.youtube-nocookie.com/embed/${previewVideoId}?cc_load_policy=1&enablejsapi=1&rel=0`}
              title="YouTube caption preview"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
            />
            <label className="yl-label" htmlFor="yl-captured-request">
              Paste the timedtext request from DevTools
            </label>
            <input
              id="yl-captured-request"
              className="yl-input"
              type="url"
              placeholder="https://www.youtube-nocookie.com/api/timedtext?...&fmt=json3"
              value={capturedRequestUrl}
              onChange={e => setCapturedRequestUrl(e.target.value)}
            />
            {replacedRequestUrl && (
              <div className="yl-replaced-request">
                <label className="yl-label" htmlFor="yl-replaced-request">
                  Request that will be fetched (fmt=json3 → fmt=srt)
                </label>
                <textarea
                  id="yl-replaced-request"
                  className="yl-textarea yl-request-preview"
                  value={replacedRequestUrl}
                  readOnly
                  rows={4}
                  aria-label="Converted timedtext request"
                />
              </div>
            )}
            <button
              className="yl-btn-secondary"
              type="button"
              onClick={handleCapturedRequest}
              disabled={capturedLoading || !replacedRequestUrl}
            >
              {capturedLoading ? 'Converting to SRT…' : 'Use captured request'}
            </button>
          </div>
        )}

        {fetchedProject && !findError && (
          <p className="yl-success">Subtitles fetched successfully. Ready to view.</p>
        )}
        {findError && <p className="yl-error">{findError}</p>}

         <button className="yl-btn-primary yl-btn-full" onClick={() => fetchedProject ? onProjectReady(fetchedProject) : handleFindLanguages()} disabled={findLoading || !url.trim()}>
           {findLoading ? 'Finding caption tracks…' : fetchedProject ? 'Continue to view →' : 'Continue →'}
        </button>
        <p className="yl-input-method-hint">
          We’ll find the available YouTube captions next. You can add more languages or change translation settings later.
        </p>
      </div> : (
        <div className="yl-setup-form yl-manual-form">
          <label className="yl-label">Project title <span className="yl-required">*</span></label>
          <input className="yl-input" type="text" placeholder="e.g. My Study Transcript" value={manualTitle} onChange={e => setManualTitle(e.target.value)} autoFocus />

          <label className="yl-label">Description <span className="yl-optional">(optional)</span></label>
          <textarea
            className="yl-textarea"
            placeholder="What is this transcript for?"
            value={manualDescription}
            onChange={e => setManualDescription(e.target.value)}
            rows={3}
          />

          <label className="yl-label">YouTube URL (optional — links video to transcript)</label>
          <input
            className="yl-input"
            type="text"
            placeholder="https://www.youtube.com/watch?v=... (optional)"
            value={manualVideoUrl}
            onChange={e => setManualVideoUrl(e.target.value)}
            onBlur={fetchManualVideoMetadata}
          />
          {manualMetadataLoading && <p className="yl-input-method-hint">Loading video title and description…</p>}

          <label className="yl-label">Translate subtitles to <span className="yl-optional">(optional — can be set later in Settings)</span></label>
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
