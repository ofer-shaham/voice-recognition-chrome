import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { translate } from "../../utils/translate";
import { bookExample } from "../../consts/config";
import isRtl from "../../utils/isRtl";
import '../../styles/YoutubeTranscriptParser.css';
import YouTubePlayer from "./YoutubePlayer";
import { convertTimeToSeconds } from "../../utils/YoutubeUtils";
import { freeSpeak } from "../../utils/freeSpeak";
import { populateAvailableVoices } from "../../utils/getVoice";
import { useAvailableVoices } from "../../hooks/useAvailableVoices";
import { useYtHistory } from "../../hooks/useYtHistory";
import { useYtProjects, YtProject } from "../../hooks/useYtProjects";
import ProjectsMenu from "./ProjectsMenu";
import NewProjectWizard from "./NewProjectWizard";

const MAX_LINES = 50;

const LANG_OPTIONS = [
  { code: "en-US", label: "English" },
  { code: "he-IL", label: "Hebrew" },
  { code: "ar-EG", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
  { code: "fr-FR", label: "French" },
  { code: "es-ES", label: "Spanish" },
  { code: "de-DE", label: "German" },
  { code: "zh-CN", label: "Chinese" },
  { code: "ja-JP", label: "Japanese" },
];

interface TranscriptLine {
  text: string;
  translation: string;
  fromLang: string;
  toLang: string;
  translated: boolean;
  timestamp: string;
}

/** An extra SRT loaded as an additional column */
interface ExtraSrtCol {
  id: string;
  label: string;
  lang: string;
  texts: string[];     // parallel array indexed to main lines
  visible: boolean;    // show column in table
  playEnabled: boolean; // include in auto-playback
}

type PlaybackConfig = { source: boolean; translation: boolean; video: boolean };

interface LogEntry {
  time: string;
  msg: string;
  type: "info" | "warn" | "error";
}

/** Tracks which word is currently being spoken for per-word highlighting */
interface ActiveWord {
  gi: number;   // global line index
  col: string;  // "source" | "translation" | extraCol.id
  charIndex: number;
  charLength: number;
}

// ── parse helpers ─────────────────────────────────────────────────────────────

function parseSrt(raw: string): { timestamp: string; text: string }[] {
  const blocks = raw.trim().split(/\n{2,}/);
  const result: { timestamp: string; text: string }[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex((l) => /\d{1,2}:\d{2}/.test(l));
    if (timeLineIdx === -1) continue;
    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)/);
    if (!match) continue;
    const timestamp = match[1].replace(",", ".");
    const text = lines.slice(timeLineIdx + 1).join(" ").trim();
    if (text) result.push({ timestamp, text });
  }
  return result;
}

function parseTimestampedTxt(raw: string): { timestamp: string; text: string }[] {
  const lines = raw.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const result: { timestamp: string; text: string }[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const timestamp = lines[i];
    const text = lines[i + 1];
    if (timestamp && text) result.push({ timestamp, text });
  }
  return result;
}

function extractVideoId(input: string): string {
  const clean = input.trim();
  const m =
    clean.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/) ||
    clean.match(/^([\w-]{11})$/);
  return m ? m[1] : clean;
}

function parseContent(raw: string): { timestamp: string; text: string }[] {
  if (/\d{1,2}:\d{2}:\d{2}[.,]\d+\s*-->/.test(raw)) return parseSrt(raw);
  if (/^\d{1,2}:\d{2}/.test(raw.trim())) return parseTimestampedTxt(raw);
  return parseSrt(raw);
}

function nowTs(): string {
  return new Date().toISOString().slice(11, 23);
}

// ── Word-highlight sub-component ──────────────────────────────────────────────

function WordHighlight({ text, active }: { text: string; active: ActiveWord | null }) {
  if (!active || !text || active.charLength === 0) return <>{text}</>;
  const { charIndex, charLength } = active;
  const before = text.slice(0, charIndex);
  const word   = text.slice(charIndex, charIndex + charLength);
  const after  = text.slice(charIndex + charLength);
  return (
    <>
      {before}
      <mark className="yt-word-highlight">{word}</mark>
      {after}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function YoutubeTranscriptParser() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlParam      = searchParams.get("url");
  const fromLangParam = searchParams.get("fromLang");
  const toLangParam   = searchParams.get("toLang");
  const videoUrlParam = searchParams.get("videoUrl");

  // ── input / config state ──────────────────────────────────────────────────
  const [inputTab, setInputTab] = useState<"url" | "paste" | "youtube" | "jobs">("url");
  const [srtUrl,   setSrtUrl]   = useState(urlParam   || bookExample.url);
  const [pasteText, setPasteText] = useState("");
  const [fromLang, setFromLang] = useState(fromLangParam || bookExample.fromLang);
  const [toLang,   setToLang]   = useState(toLangParam   || bookExample.toLang);
  const [videoUrl, setVideoUrl] = useState(videoUrlParam || bookExample.videoUrl);
  const videoId = extractVideoId(videoUrl);

  const [lines,     setLines]     = useState<TranscriptLine[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [loadError, setLoadError] = useState("");

  const [playbackConfig, setPlaybackConfig] = useState<PlaybackConfig>({
    source: true, translation: false, video: false,
  });

  // extra SRT columns
  const [extraCols,      setExtraCols]      = useState<ExtraSrtCol[]>([]);
  const [addSrtOpen,     setAddSrtOpen]     = useState(false);
  const [newSrtInputTab, setNewSrtInputTab] = useState<"url" | "paste">("url");
  const [newSrtUrl,      setNewSrtUrl]      = useState("");
  const [newSrtPaste,    setNewSrtPaste]    = useState("");
  const [newSrtLang,     setNewSrtLang]     = useState("en-US");
  const [newSrtLabel,    setNewSrtLabel]    = useState("");
  const [newSrtLoading,  setNewSrtLoading]  = useState(false);

  // playback order — default: source → translation → video
  const [playOrder, setPlayOrder] = useState<string[]>(["source", "translation", "video"]);

  const [ttsRateSource, setTtsRateSource] = useState(1.0);
  const [ttsRateTrans,  setTtsRateTrans]  = useState(1.0);
  const [showThumbnails, setShowThumbnails] = useState(false);

  // ── playback runtime state ────────────────────────────────────────────────
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [isVideoPhase, setIsVideoPhase] = useState(false); // true only during the video step
  const [activeWord,   setActiveWord]   = useState<ActiveWord | null>(null);
  const playingRef = useRef(false);
  const stopRef    = useRef(false);

  // Google TTS usage counters
  const [gttsCount, setGttsCount] = useState(0);
  const [gttsChars, setGttsChars] = useState(0);

  // YouTube SRT fetch (📺 tab)
  const [ytFetchLang,    setYtFetchLang]    = useState(fromLang);
  const [ytFetchLoading, setYtFetchLoading] = useState(false);
  const [ytFetchError,   setYtFetchError]   = useState("");

  // Job history (📂 tab)
  const { jobs, saveJob, deleteJob, updateTitle } = useYtHistory();
  const [saveTitle,      setSaveTitle]      = useState("");
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [editingTitle,   setEditingTitle]   = useState("");

  // Projects system
  const { projects, saveProject, deleteProject, setLastProjectId } = useYtProjects();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showWizard,       setShowWizard]        = useState(false);
  const currentProjectRef = useRef<YtProject | null>(null);

  // ── pagination / selection ────────────────────────────────────────────────
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [linesPerPage, setLinesPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

  // ── event log ─────────────────────────────────────────────────────────────
  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [showLog,  setShowLog]  = useState(false);

  const availableVoices = useAvailableVoices();

  useEffect(() => {
    if (availableVoices.length) populateAvailableVoices(availableVoices);
  }, [availableVoices]);

  useEffect(() => {
    setSearchParams({
      ...(srtUrl ? { url: srtUrl } : {}),
      fromLang, toLang, videoUrl,
    });
  }, [srtUrl, fromLang, toLang, videoUrl, setSearchParams]);

  const logEvent = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setEventLog((prev) => [{ time: nowTs(), msg, type }, ...prev].slice(0, 200));
  }, []);

  // ── refs for stale-closure-safe playback loop ─────────────────────────────
  const playOrderRef       = useRef(playOrder);
  const extraColsRef       = useRef(extraCols);
  const playbackConfigRef  = useRef(playbackConfig);
  const ttsRateSourceRef   = useRef(ttsRateSource);
  const ttsRateTransRef    = useRef(ttsRateTrans);
  const availableVoicesRef = useRef(availableVoices);
  const linesRef           = useRef(lines);
  const linesPerPageRef    = useRef(linesPerPage);

  useEffect(() => { playOrderRef.current       = playOrder;       }, [playOrder]);
  useEffect(() => { extraColsRef.current       = extraCols;       }, [extraCols]);
  useEffect(() => { playbackConfigRef.current  = playbackConfig;  }, [playbackConfig]);
  useEffect(() => { ttsRateSourceRef.current   = ttsRateSource;   }, [ttsRateSource]);
  useEffect(() => { ttsRateTransRef.current    = ttsRateTrans;    }, [ttsRateTrans]);
  useEffect(() => { availableVoicesRef.current = availableVoices; }, [availableVoices]);
  useEffect(() => { linesRef.current           = lines;           }, [lines]);
  useEffect(() => { linesPerPageRef.current    = linesPerPage;    }, [linesPerPage]);

  // ── build lines ───────────────────────────────────────────────────────────
  const buildLines = useCallback(
    (parsed: { timestamp: string; text: string }[]): TranscriptLine[] =>
      parsed.map((p) => ({
        text: p.text, translation: "", fromLang, toLang,
        translated: false, timestamp: p.timestamp,
      })),
    [fromLang, toLang]
  );

  // ── load primary SRT ──────────────────────────────────────────────────────
  const handleLoad = () => {
    setLoadError(""); setLines([]); setLoading(true);
    logEvent(`Loading SRT: ${srtUrl}`);
    fetch(srtUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if ((r.headers.get("Content-Type") || "").includes("text/html"))
          throw new Error("Got HTML, not SRT");
        return r.text();
      })
      .then((raw) => {
        const parsed = parseContent(raw);
        if (!parsed.length) throw new Error("No lines parsed — check file format");
        setLines(buildLines(parsed));
        setCurrentPage(1);
        logEvent(`Loaded ${parsed.length} lines`);
      })
      .catch((e) => { setLoadError(e.message); logEvent(e.message, "error"); })
      .finally(() => setLoading(false));
  };

  const handlePasteLoad = () => {
    setLoadError("");
    if (!pasteText.trim()) { setLoadError("Paste some SRT content first"); return; }
    const parsed = parseContent(pasteText);
    if (!parsed.length) { setLoadError("No lines parsed — check format"); return; }
    setLines(buildLines(parsed)); setCurrentPage(1);
    logEvent(`Pasted ${parsed.length} lines`);
  };

  // ── YouTube SRT fetch ─────────────────────────────────────────────────────
  const handleYtFetch = useCallback(async () => {
    if (!videoId) { setYtFetchError("Enter a YouTube URL / video ID first"); return; }
    setYtFetchError(""); setYtFetchLoading(true); setLines([]);
    const langCode = ytFetchLang.split("-")[0];
    logEvent(`📺 Fetching YouTube SRT: ${videoId} [${langCode}]`);
    try {
      const r = await fetch(`/api/srt?videoId=${encodeURIComponent(videoId)}&lang=${langCode}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const raw = await r.text();
      const parsed = parseContent(raw);
      if (!parsed.length) throw new Error("No lines parsed from transcript");
      setLines(buildLines(parsed)); setCurrentPage(1);
      logEvent(`📺 Loaded ${parsed.length} lines from YouTube [${langCode}]`);
      setSrtUrl(""); // clear URL field so it's clear this was fetched from YouTube
    } catch (e: any) {
      setYtFetchError(e.message);
      logEvent(`📺 Fetch failed: ${e.message}`, "error");
    } finally {
      setYtFetchLoading(false);
    }
  }, [videoId, ytFetchLang, buildLines, logEvent]);

  // ── job history helpers ────────────────────────────────────────────────────
  const handleSaveJob = useCallback(() => {
    const title = saveTitle.trim() ||
      (srtUrl ? srtUrl.split("/").pop()?.replace(/\.[^.]+$/, "") || srtUrl : `YouTube ${videoId}`) ||
      new Date().toLocaleString();
    saveJob({ title, srtUrl, fromLang, toLang, videoUrl });
    setSaveTitle("");
    logEvent(`💾 Saved job: "${title}"`);
  }, [saveTitle, srtUrl, fromLang, toLang, videoUrl, saveJob, logEvent, videoId]);

  const handleLoadJob = useCallback((job: import("../../hooks/useYtHistory").YtJob) => {
    setSrtUrl(job.srtUrl);
    setFromLang(job.fromLang);
    setToLang(job.toLang);
    setVideoUrl(job.videoUrl);
    setInputTab("url");
    setLines([]); setLoadError("");
    logEvent(`📂 Loaded job: "${job.title}"`);
  }, []);

  // ── project load ──────────────────────────────────────────────────────────
  const loadProject = useCallback((project: YtProject) => {
    if (!project.tracks.length) return;

    const primary = project.tracks[0];
    const parsed  = parseContent(primary.srtContent);
    setLines(parsed.map(p => ({
      text: p.text, translation: "", fromLang: primary.lang, toLang,
      translated: false, timestamp: p.timestamp,
    })));
    setCurrentPage(1);
    setFromLang(primary.lang);

    const extras: ExtraSrtCol[] = project.tracks.slice(1).map(track => ({
      id:          `track:${track.lang}`,
      label:       track.langLabel,
      lang:        track.lang,
      texts:       parseContent(track.srtContent).map(p => p.text),
      visible:     true,
      playEnabled: true,
    }));
    setExtraCols(extras);

    const restored = project.playOrder.length
      ? project.playOrder
      : ["video", ...extras.map(e => e.id)];
    setPlayOrder(restored);

    if (project.videoId) {
      setVideoUrl(`https://www.youtube.com/watch?v=${project.videoId}`);
    }

    if (project.lastPlayedLine > 0) {
      setCurrentPage(Math.floor(project.lastPlayedLine / linesPerPage) + 1);
    }

    currentProjectRef.current = project;
    setCurrentProjectId(project.id);
    setLastProjectId(project.id);
    setInputTab("youtube");
    setLines([]); // reset first so translation effect re-fires on page 1
    setLines(parsed.map(p => ({
      text: p.text, translation: "", fromLang: primary.lang, toLang,
      translated: false, timestamp: p.timestamp,
    })));
    logEvent(`📂 Project loaded: "${project.title}" — ${project.tracks.length} track(s)`);
  }, [toLang, linesPerPage, logEvent, setLastProjectId]);

  // Keep currentProjectRef in sync when projects list changes (e.g. after save)
  useEffect(() => {
    if (!currentProjectId) { currentProjectRef.current = null; return; }
    const p = projects.find(pr => pr.id === currentProjectId) ?? null;
    if (p) currentProjectRef.current = p;
  }, [currentProjectId, projects]);

  // Auto-save playOrder back to the current project
  useEffect(() => {
    const proj = currentProjectRef.current;
    if (!proj) return;
    const updated = { ...proj, playOrder, updatedAt: Date.now() };
    currentProjectRef.current = updated;
    saveProject(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playOrder]);

  // Auto-save last played line back to the current project
  useEffect(() => {
    if (playingIndex === null) return;
    const proj = currentProjectRef.current;
    if (!proj) return;
    const updated = { ...proj, lastPlayedLine: playingIndex, updatedAt: Date.now() };
    currentProjectRef.current = updated;
    saveProject(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingIndex]);

  // ── extra SRT columns ─────────────────────────────────────────────────────
  const handleAddExtraSrt = useCallback(async () => {
    const id    = `extra_${Date.now()}`;
    const label = newSrtLabel.trim() || (LANG_OPTIONS.find(l => l.code === newSrtLang)?.label ?? newSrtLang);
    let texts: string[] = [];

    if (newSrtInputTab === "paste") {
      texts = parseContent(newSrtPaste).map(p => p.text);
      if (!texts.length) { logEvent("Extra SRT: no lines parsed", "error"); return; }
    } else {
      if (!newSrtUrl.trim()) return;
      setNewSrtLoading(true);
      try {
        const r = await fetch(newSrtUrl.trim());
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        texts = parseContent(await r.text()).map(p => p.text);
        if (!texts.length) throw new Error("No lines parsed");
      } catch (e: any) {
        logEvent(`Extra SRT load failed: ${e.message}`, "error");
        setNewSrtLoading(false);
        return;
      }
      setNewSrtLoading(false);
    }

    setExtraCols(prev => [...prev, { id, label, lang: newSrtLang, texts, visible: true, playEnabled: true }]);
    setPlayOrder(prev => [...prev, id]);
    setAddSrtOpen(false);
    setNewSrtUrl(""); setNewSrtLabel(""); setNewSrtPaste("");
    logEvent(`Added SRT column "${label}" (${texts.length} entries)`);
  }, [newSrtUrl, newSrtPaste, newSrtLang, newSrtLabel, newSrtInputTab, logEvent]);

  const removeExtraCol = (id: string) => {
    setExtraCols(prev => prev.filter(c => c.id !== id));
    setPlayOrder(prev => prev.filter(s => s !== id));
  };

  const toggleExtraColProp = (id: string, prop: "visible" | "playEnabled") =>
    setExtraCols(prev => prev.map(c => c.id === id ? { ...c, [prop]: !c[prop] } : c));

  // ── translate visible lines lazily ────────────────────────────────────────
  useEffect(() => {
    if (!lines.length) return;
    const start = (currentPage - 1) * linesPerPage;
    const end   = Math.min(start + linesPerPage, lines.length);
    const jobs  = lines.slice(start, end)
      .map((l, vi) => ({ line: l, gi: start + vi }))
      .filter(({ line }) => !line.translated);
    if (!jobs.length) return;

    logEvent(`Translating ${jobs.length} line(s) (page ${currentPage})`);
    Promise.all(
      jobs.map(async ({ line, gi }) => {
        const translation = await translate({
          finalTranscriptProxy: line.text,
          fromLang: line.fromLang, toLang: line.toLang,
        });
        return { gi, translation };
      })
    ).then((results) => {
      setLines((prev) => {
        const next = [...prev];
        for (const { gi, translation } of results)
          next[gi] = { ...next[gi], translation, translated: true };
        return next;
      });
      logEvent(`Translation done for ${results.length} line(s)`);
    }).catch((e) => logEvent(`Translation error: ${e.message}`, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, linesPerPage, lines.length, toLang]);

  // ── speakText — Web Speech API with Google TTS fallback + word boundary ───
  const speakText = useCallback(
    (text: string, lang: string, rate: number, gi?: number, colId?: string): Promise<void> =>
      new Promise((resolve) => {
        window.speechSynthesis.cancel();
        setActiveWord(null);

        const voices   = availableVoicesRef.current;
        const baseLang = lang.split(/[-_]/)[0].toLowerCase();
        const voice    =
          voices.find(v => v.lang === lang || v.lang.replace("_", "-") === lang) ||
          voices.find(v => v.lang.split(/[-_]/)[0].toLowerCase() === baseLang) ||
          null;

        // ── Server-side TTS proxy fallback when no browser voice matches ────
        if (!voice && voices.length > 0) {
          const shortLang = lang.split("-")[0];
          const url = `/api/tts?lang=${shortLang}&text=${encodeURIComponent(text.slice(0, 200))}`;
          logEvent(`  🌐 Server TTS [${lang}]: "${text.slice(0, 35)}…"`, "warn");
          setGttsCount(c => c + 1);
          setGttsChars(c => c + Math.min(text.length, 200));
          const audio = new Audio(url);
          audio.onended  = () => resolve();
          audio.onerror  = () => { logEvent(`  Google TTS error [${lang}]`, "warn"); resolve(); };
          audio.play().catch(() => { logEvent(`  Google TTS blocked (needs prior user click)`, "warn"); resolve(); });
          return;
        }

        const utt  = new SpeechSynthesisUtterance(text);
        utt.lang   = lang;
        utt.rate   = rate;
        if (voice) {
          utt.voice = voice;
          logEvent(`  🔊 ${voice.name} [${voice.lang}] ×${rate.toFixed(1)}`);
        } else {
          logEvent(`  🔊 browser default [${lang}] ×${rate.toFixed(1)}`);
        }

        // Per-word boundary tracking
        if (gi !== undefined && colId !== undefined) {
          utt.onboundary = (e: SpeechSynthesisEvent) => {
            if (e.name === "word") {
              setActiveWord({ gi, col: colId, charIndex: e.charIndex, charLength: (e as any).charLength ?? 0 });
            }
          };
        }

        // Chrome bug: resume every 5 s to prevent silent pause on long utterances
        const resumeTimer = setInterval(() => {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 5000);

        const cleanup = () => { clearInterval(resumeTimer); setActiveWord(null); resolve(); };
        utt.onend   = cleanup;
        utt.onerror = (e) => { logEvent(`TTS error [${lang}]: ${e.error}`, "warn"); cleanup(); };
        setTimeout(() => window.speechSynthesis.speak(utt), 60);
      }),
    [logEvent]
  );

  // Keep a stable ref so the async loop always calls the current version
  const speakTextRef = useRef(speakText);
  useEffect(() => { speakTextRef.current = speakText; }, [speakText]);

  const getStopTime = useCallback((index: number): string =>
    index + 1 < linesRef.current.length ? linesRef.current[index + 1].timestamp : "99:99:99",
  []);

  // ── playFromLine — main playback loop ─────────────────────────────────────
  const playFromLine = useCallback(async (startIdx: number) => {
    if (playingRef.current) {
      stopRef.current = true;
      window.speechSynthesis.cancel();
      logEvent("Stopping previous playback");
      await new Promise((r) => setTimeout(r, 300));
    }
    stopRef.current  = false;
    playingRef.current = true;
    setIsPlaying(true); setIsVideoPhase(false); setActiveWord(null);
    logEvent(`▶ Playback start from line ${startIdx + 1}`);

    const ls = linesRef.current;

    for (let i = startIdx; i < ls.length; i++) {
      if (stopRef.current) break;
      setPlayingIndex(i); setIsVideoPhase(false); setActiveWord(null);
      setCurrentPage(Math.floor(i / linesPerPageRef.current) + 1);
      logEvent(`── Line ${i + 1} [${ls[i].timestamp}]: "${ls[i].text.slice(0, 40)}"`);

      for (const step of playOrderRef.current) {
        if (stopRef.current) break;
        const cfg = playbackConfigRef.current;

        if (step === "source" && cfg.source) {
          logEvent(`  ▶ source [${ls[i].fromLang}]`);
          await speakTextRef.current(ls[i].text, ls[i].fromLang, ttsRateSourceRef.current, i, "source");

        } else if (step === "translation" && cfg.translation) {
          if (ls[i].translation) {
            logEvent(`  ▶ translation [${ls[i].toLang}]`);
            await speakTextRef.current(ls[i].translation, ls[i].toLang, ttsRateTransRef.current, i, "translation");
          } else {
            logEvent(`  ⏭ translation not ready yet — skipping`);
          }

        } else if (step === "video" && cfg.video) {
          const startSec = convertTimeToSeconds(ls[i].timestamp);
          const stopTime = getStopTime(i);
          const stopSec  = convertTimeToSeconds(stopTime);
          const duration = Math.max(0, (stopSec - startSec) * 1000);
          logEvent(`  ▶ video [${ls[i].timestamp} → ${stopTime}] (${(duration / 1000).toFixed(1)}s)`);
          setIsVideoPhase(true);
          if (duration > 0) await new Promise((r) => setTimeout(r, duration));
          setIsVideoPhase(false);

        } else if (step.startsWith("extra_")) {
          const col = extraColsRef.current.find(c => c.id === step);
          if (col?.playEnabled) {
            const txt = col.texts[i];
            if (txt) {
              logEvent(`  ▶ ${col.label} [${col.lang}]`);
              await speakTextRef.current(txt, col.lang, ttsRateSourceRef.current, i, col.id);
            }
          }
        }
      }
    }

    playingRef.current = false;
    setIsPlaying(false); setIsVideoPhase(false);
    setPlayingIndex(null); setActiveWord(null);
    logEvent(stopRef.current ? "■ Playback stopped" : "✓ Playback complete");
  }, [logEvent, getStopTime]);

  const stopPlayback = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false); setIsVideoPhase(false);
    setPlayingIndex(null); setActiveWord(null);
    logEvent("■ Stop pressed");
  };

  // ── inline speak with per-word highlight ──────────────────────────────────
  const speakInline = useCallback((text: string, lang: string, gi: number, colId: string) => {
    setActiveWord(null);
    freeSpeak(text, lang, 1.0, undefined, (ci, cl) => {
      setActiveWord({ gi, col: colId, charIndex: ci, charLength: cl });
    }).then(() => setActiveWord(null)).catch(() => setActiveWord(null));
  }, []);

  // ── playback order helpers ────────────────────────────────────────────────
  const moveStep = (idx: number, dir: -1 | 1) => {
    const o = [...playOrder];
    const t = idx + dir;
    if (t < 0 || t >= o.length) return;
    [o[idx], o[t]] = [o[t], o[idx]];
    setPlayOrder(o);
  };

  const stepLabel = (step: string): string => {
    if (step === "source")      return `🔊 ${LANG_OPTIONS.find(l => l.code === fromLang)?.label ?? fromLang}`;
    if (step === "translation") return `📝 ${LANG_OPTIONS.find(l => l.code === toLang)?.label ?? toLang}`;
    if (step === "video")       return "🎬 Video";
    const col = extraCols.find(c => c.id === step);
    return col ? `💬 ${col.label}` : step;
  };

  const stepEnabled = (step: string): boolean => {
    if (step === "source")      return playbackConfig.source;
    if (step === "translation") return playbackConfig.translation;
    if (step === "video")       return playbackConfig.video;
    return extraCols.find(c => c.id === step)?.playEnabled ?? false;
  };

  const toggleCol = (col: keyof PlaybackConfig) =>
    setPlaybackConfig((p) => ({ ...p, [col]: !p[col] }));

  // ── render helpers ────────────────────────────────────────────────────────
  const visibleLines = lines.slice((currentPage - 1) * linesPerPage, currentPage * linesPerPage);
  const fromRtl = isRtl(fromLang);
  const toRtl   = isRtl(toLang);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="yt-page">

      {/* ── projects bar ── */}
      <ProjectsMenu
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={(p) => loadProject(p)}
        onNewProject={() => setShowWizard(true)}
        onDeleteProject={(id) => {
          deleteProject(id);
          if (currentProjectId === id) {
            setCurrentProjectId(null);
            currentProjectRef.current = null;
          }
        }}
      />

      {/* ── sticky header ── */}
      <div className="yt-header">
        <h2 className="yt-title">📺 YouTube SRT Player</h2>

        {/* Column play toggles */}
        <div className="yt-playback-config">
          <span className="yt-config-label">Play:</span>
          {(["source", "translation", "video"] as (keyof PlaybackConfig)[]).map((col) => (
            <label key={col} className={`yt-col-toggle${playbackConfig[col] ? " active" : ""}`}>
              <input type="checkbox" checked={playbackConfig[col]} onChange={() => toggleCol(col)} />
              {col === "source"      ? `🔊 ${LANG_OPTIONS.find(l => l.code === fromLang)?.label ?? fromLang}`
               : col === "translation" ? `📝 ${LANG_OPTIONS.find(l => l.code === toLang)?.label ?? toLang}`
               : "🎬 Video"}
            </label>
          ))}
          {extraCols.map(col => (
            <label key={col.id} className={`yt-col-toggle${col.playEnabled ? " active" : ""}`}>
              <input type="checkbox" checked={col.playEnabled} onChange={() => toggleExtraColProp(col.id, "playEnabled")} />
              💬 {col.label}
            </label>
          ))}
        </div>

        {/* TTS speed */}
        <div className="yt-rate-controls">
          <span className="yt-config-label">Speed:</span>
          <label className="yt-rate-label">
            Src
            <input type="range" min={0.5} max={2} step={0.1} value={ttsRateSource}
              onChange={(e) => setTtsRateSource(Number(e.target.value))} className="yt-rate-slider" />
            <span className="yt-rate-val">{ttsRateSource.toFixed(1)}×</span>
          </label>
          <label className="yt-rate-label">
            Trans
            <input type="range" min={0.5} max={2} step={0.1} value={ttsRateTrans}
              onChange={(e) => setTtsRateTrans(Number(e.target.value))} className="yt-rate-slider" />
            <span className="yt-rate-val">{ttsRateTrans.toFixed(1)}×</span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="yt-header-actions">
          <button className={`yt-icon-btn${showThumbnails ? " active" : ""}`}
            onClick={() => setShowThumbnails(v => !v)} title="Toggle thumbnails">🖼 Thumbs</button>
          <button className={`yt-icon-btn${showLog ? " active" : ""}`}
            onClick={() => setShowLog(v => !v)}>
            📋 Log{eventLog.length > 0 ? ` (${eventLog.length})` : ""}
            {gttsCount > 0 && <span className="yt-gtts-badge" title={`~${gttsChars} chars via Google TTS`}> 🌐{gttsCount}</span>}
          </button>
          {isPlaying && <button className="yt-stop-btn" onClick={stopPlayback}>■ Stop</button>}
        </div>
      </div>

      {/* ── playback order strip ── */}
      <div className="yt-order-strip">
        <span className="yt-config-label">Order:</span>
        <div className="yt-order-items">
          {playOrder.map((step, idx) => (
            <div key={step} className={`yt-order-item${stepEnabled(step) ? " active" : ""}`}>
              <span className="yt-order-label">{stepLabel(step)}</span>
              <button className="yt-order-btn" onClick={() => moveStep(idx, -1)} disabled={idx === 0} title="Earlier">▲</button>
              <button className="yt-order-btn" onClick={() => moveStep(idx, 1)} disabled={idx === playOrder.length - 1} title="Later">▼</button>
            </div>
          ))}
        </div>
      </div>

      {/* ── input card ── */}
      <div className="yt-input-card">
        <div className="yt-tabs">
          <button className={`yt-tab${inputTab === "url"     ? " active" : ""}`} onClick={() => setInputTab("url")}>🔗 URL</button>
          <button className={`yt-tab${inputTab === "paste"   ? " active" : ""}`} onClick={() => setInputTab("paste")}>📋 Paste SRT</button>
          <button className={`yt-tab${inputTab === "youtube" ? " active" : ""}`} onClick={() => setInputTab("youtube")}>📺 YouTube</button>
          <button className={`yt-tab${inputTab === "jobs"    ? " active" : ""}`} onClick={() => setInputTab("jobs")}>
            📂 Jobs{jobs.length > 0 ? ` (${jobs.length})` : ""}
          </button>
        </div>

        {inputTab === "url" && (
          <div className="yt-url-row">
            <input className="yt-url-input" type="text" value={srtUrl}
              onChange={(e) => setSrtUrl(e.target.value)} placeholder="https://example.com/subtitles.srt" />
            <button className="yt-load-btn" onClick={handleLoad} disabled={loading}>{loading ? "Loading…" : "Load"}</button>
          </div>
        )}

        {inputTab === "paste" && (
          <div className="yt-paste-area">
            <textarea className="yt-paste-textarea" value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste SRT content here…\n\n1\n00:00:01,000 --> 00:00:04,000\nHello world"} rows={8} />
            <button className="yt-load-btn" onClick={handlePasteLoad}>Parse</button>
          </div>
        )}

        {/* ── 📺 YouTube fetch tab ── */}
        {inputTab === "youtube" && (
          <div className="yt-yt-fetch-panel">
            <p className="yt-yt-fetch-hint">
              Fetch the transcript directly from YouTube using the video ID below.
              Enter the video URL in the meta row first.
            </p>
            {videoId ? (
              <div className="yt-yt-fetch-row">
                <span className="yt-yt-id-pill">📺 {videoId}</span>
                <select className="yt-select" value={ytFetchLang}
                  onChange={(e) => setYtFetchLang(e.target.value)}>
                  {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <button className="yt-load-btn" onClick={handleYtFetch} disabled={ytFetchLoading}>
                  {ytFetchLoading ? "Fetching…" : "Fetch Transcript"}
                </button>
              </div>
            ) : (
              <div className="yt-error">⚠ Enter a YouTube URL or video ID in the meta row first</div>
            )}
            {ytFetchError && <div className="yt-error" style={{ marginTop: 6 }}>⚠ {ytFetchError}</div>}
          </div>
        )}

        {/* ── 📂 Job history tab ── */}
        {inputTab === "jobs" && (
          <div className="yt-jobs-panel">
            <div className="yt-jobs-save-row">
              <input className="yt-url-input" type="text" value={saveTitle}
                onChange={(e) => setSaveTitle(e.target.value)}
                placeholder="Job title (auto-generated if blank)" />
              <button className="yt-load-btn" onClick={handleSaveJob}>💾 Save current</button>
            </div>
            {jobs.length === 0 ? (
              <div className="yt-jobs-empty">No saved jobs yet — load an SRT and click Save.</div>
            ) : (
              <div className="yt-jobs-list">
                {jobs.map(job => (
                  <div key={job.id} className="yt-job-item">
                    <div className="yt-job-left">
                      {editingId === job.id ? (
                        <input className="yt-job-title-input" value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => { updateTitle(job.id, editingTitle); setEditingId(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") { updateTitle(job.id, editingTitle); setEditingId(null); } }}
                          autoFocus />
                      ) : (
                        <span className="yt-job-title"
                          onClick={() => { setEditingId(job.id); setEditingTitle(job.title); }}
                          title="Click to rename">{job.title}</span>
                      )}
                      <span className="yt-job-meta">
                        {new Date(job.createdAt).toLocaleDateString()} · {job.fromLang} → {job.toLang}
                        {job.srtUrl && <> · <span className="yt-job-url">{job.srtUrl.split("/").pop()}</span></>}
                      </span>
                    </div>
                    <div className="yt-job-actions">
                      <button className="yt-job-load-btn" onClick={() => handleLoadJob(job)}>▶ Load</button>
                      <button className="yt-job-del-btn" onClick={() => deleteJob(job.id)}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="yt-meta-row">
          <div className="yt-field-group">
            <label className="yt-field-label">Source lang</label>
            <select className="yt-select" value={fromLang} onChange={(e) => setFromLang(e.target.value)}>
              {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="yt-field-group">
            <label className="yt-field-label">Translate to</label>
            <select className="yt-select" value={toLang} onChange={(e) => setToLang(e.target.value)}>
              {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="yt-field-group yt-field-group--wide">
            <label className="yt-field-label">YouTube URL or ID</label>
            <input className="yt-select" type="text" value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or video ID" />
            {videoId && videoId !== videoUrl && <span className="yt-video-id-hint">ID: {videoId}</span>}
          </div>
          <div className="yt-field-group">
            <label className="yt-field-label">Lines / page</label>
            <input className="yt-select" type="number" min={1} max={MAX_LINES} value={linesPerPage}
              onChange={(e) => setLinesPerPage(Math.min(MAX_LINES, Math.max(1, Number(e.target.value))))} />
          </div>
        </div>

        {/* ── extra SRT columns ── */}
        <div className="yt-extra-srts">
          {extraCols.length > 0 && (
            <div className="yt-extra-cols-list">
              {extraCols.map(col => (
                <div key={col.id} className={`yt-extra-col-badge${col.visible ? " visible" : ""}`}>
                  <span className="yt-extra-col-name">{col.label}</span>
                  <span className="yt-extra-col-meta">[{col.lang}] {col.texts.length}ln</span>
                  <button
                    className={`yt-extra-col-eye${col.visible ? " on" : ""}`}
                    onClick={() => toggleExtraColProp(col.id, "visible")}
                    title={col.visible ? "Hide column" : "Show column"}
                  >{col.visible ? "👁" : "🙈"}</button>
                  <button className="yt-extra-col-rm" onClick={() => removeExtraCol(col.id)} title="Remove">✕</button>
                </div>
              ))}
            </div>
          )}

          <button className={`yt-icon-btn${addSrtOpen ? " active" : ""}`}
            onClick={() => setAddSrtOpen(v => !v)}>＋ SRT column</button>

          {addSrtOpen && (
            <div className="yt-add-srt-panel">
              <div className="yt-tabs" style={{ marginBottom: 8 }}>
                <button className={`yt-tab${newSrtInputTab === "url"   ? " active" : ""}`} onClick={() => setNewSrtInputTab("url")}>🔗 URL</button>
                <button className={`yt-tab${newSrtInputTab === "paste" ? " active" : ""}`} onClick={() => setNewSrtInputTab("paste")}>📋 Paste</button>
              </div>
              {newSrtInputTab === "url" ? (
                <input className="yt-url-input" type="text" value={newSrtUrl}
                  onChange={(e) => setNewSrtUrl(e.target.value)} placeholder="SRT URL…" />
              ) : (
                <textarea className="yt-paste-textarea" value={newSrtPaste}
                  onChange={(e) => setNewSrtPaste(e.target.value)}
                  placeholder="Paste SRT here…" rows={4} />
              )}
              <div className="yt-add-srt-meta">
                <select className="yt-select" value={newSrtLang} onChange={(e) => setNewSrtLang(e.target.value)}>
                  {LANG_OPTIONS.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <input className="yt-select" type="text" value={newSrtLabel}
                  onChange={(e) => setNewSrtLabel(e.target.value)} placeholder="Label (optional)" style={{ flex: 1 }} />
                <button className="yt-load-btn" onClick={handleAddExtraSrt} disabled={newSrtLoading}>
                  {newSrtLoading ? "Loading…" : "Add"}
                </button>
              </div>
            </div>
          )}
        </div>

        {loadError && <div className="yt-error">⚠ {loadError}</div>}
      </div>

      {/* ── transcript table ── */}
      {lines.length > 0 && (
        <>
          <div className="yt-table-wrap">
            <table className="yt-table">
              <thead>
                <tr>
                  <th className="yt-th-num">#</th>
                  <th className="yt-th-time">Time</th>
                  <th className={`yt-th-text${fromRtl ? " rtl" : ""}`}>
                    {LANG_OPTIONS.find(l => l.code === fromLang)?.label ?? fromLang}
                    {playbackConfig.source && <span className="yt-col-badge">🔊</span>}
                  </th>
                  <th className={`yt-th-text${toRtl ? " rtl" : ""}`}>
                    {LANG_OPTIONS.find(l => l.code === toLang)?.label ?? toLang}
                    {playbackConfig.translation && <span className="yt-col-badge">🔊</span>}
                  </th>
                  {extraCols.filter(c => c.visible).map(col => (
                    <th key={col.id} className={`yt-th-text${isRtl(col.lang) ? " rtl" : ""}`}>
                      {col.label}
                      {col.playEnabled && <span className="yt-col-badge">🔊</span>}
                      <button className="yt-col-hide-btn"
                        onClick={() => toggleExtraColProp(col.id, "visible")} title="Hide column">✕</button>
                    </th>
                  ))}
                  {playbackConfig.video && <th className="yt-th-video">🎬 Video</th>}
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line, vi) => {
                  const gi       = (currentPage - 1) * linesPerPage + vi;
                  const isActive = playingIndex === gi;
                  const isSelected = selectedLine === gi;
                  const srcWord   = isActive && activeWord?.col === "source"      ? activeWord : null;
                  const transWord = isActive && activeWord?.col === "translation" ? activeWord : null;

                  return (
                    <tr key={gi}
                      className={`yt-row${isActive ? " yt-row-playing" : ""}${isSelected ? " yt-row-selected" : ""}`}
                      onClick={() => { setSelectedLine(gi); playFromLine(gi); }}
                      title="Click to play from this line"
                    >
                      <td className="yt-td-num">{gi + 1}</td>
                      <td className="yt-td-time">{line.timestamp}</td>

                      {/* Source column */}
                      <td className={`yt-td-text${fromRtl ? " rtl" : ""}`}>
                        {srcWord ? (
                          <span className="yt-speaking">
                            <WordHighlight text={line.text} active={srcWord} />
                          </span>
                        ) : (
                          <span className={isActive && playbackConfig.source ? "yt-speaking" : ""}>
                            {line.text}
                          </span>
                        )}
                        <button className="yt-speak-btn" title="Speak source"
                          onClick={(e) => { e.stopPropagation(); speakInline(line.text, line.fromLang, gi, "source"); }}>🔊</button>
                      </td>

                      {/* Translation column */}
                      <td className={`yt-td-text${toRtl ? " rtl" : ""}`}>
                        {line.translated ? (
                          <>
                            {transWord ? (
                              <span className="yt-speaking">
                                <WordHighlight text={line.translation} active={transWord} />
                              </span>
                            ) : (
                              <span className={isActive && playbackConfig.translation ? "yt-speaking" : ""}>
                                {line.translation}
                              </span>
                            )}
                            <button className="yt-speak-btn" title="Speak translation"
                              onClick={(e) => { e.stopPropagation(); speakInline(line.translation, line.toLang, gi, "translation"); }}>🔊</button>
                          </>
                        ) : (
                          <span className="yt-translating">translating…</span>
                        )}
                      </td>

                      {/* Extra SRT columns */}
                      {extraCols.filter(c => c.visible).map(col => {
                        const colWord = isActive && activeWord?.col === col.id ? activeWord : null;
                        const txt     = col.texts[gi];
                        const rtlCol  = isRtl(col.lang);
                        return (
                          <td key={col.id} className={`yt-td-text${rtlCol ? " rtl" : ""}`}>
                            {txt ? (
                              <>
                                {colWord ? (
                                  <span className="yt-speaking">
                                    <WordHighlight text={txt} active={colWord} />
                                  </span>
                                ) : (
                                  <span className={isActive && col.playEnabled ? "yt-speaking" : ""}>{txt}</span>
                                )}
                                <button className="yt-speak-btn" title={`Speak ${col.label}`}
                                  onClick={(e) => { e.stopPropagation(); speakInline(txt, col.lang, gi, col.id); }}>🔊</button>
                              </>
                            ) : <span className="yt-no-text">—</span>}
                          </td>
                        );
                      })}

                      {/* Video column — only autoplay when we're in the video phase for this row */}
                      {playbackConfig.video && (
                        <td className="yt-td-video" onClick={(e) => e.stopPropagation()}>
                          {isActive && isVideoPhase ? (
                            <YouTubePlayer videoId={videoId} startTime={line.timestamp}
                              stopTime={getStopTime(gi)} autoplay />
                          ) : showThumbnails ? (
                            <YouTubePlayer videoId={videoId} startTime={line.timestamp}
                              stopTime={getStopTime(gi)} thumbnail />
                          ) : (
                            <span className="yt-td-ts-label">{line.timestamp}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── pagination ── */}
          <div className="yt-pagination">
            <button className="yt-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>◀ Prev</button>
            <span className="yt-page-info">
              Page {currentPage} / {totalPages}
              <span className="yt-line-count"> ({lines.length} lines)</span>
            </span>
            <button className="yt-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next ▶</button>
          </div>
        </>
      )}

      {!lines.length && !loading && (
        <div className="yt-empty">
          <div className="yt-empty-icon">📄</div>
          <p>Load an SRT file or paste SRT content to get started.</p>
          <p className="yt-empty-sub">Use the URL or Paste tabs above, then click Load / Parse.</p>
        </div>
      )}

      {loading && (
        <div className="yt-empty">
          <div className="yt-empty-icon">⏳</div>
          <p>Loading…</p>
        </div>
      )}

      {/* ── new project wizard overlay ── */}
      {showWizard && (
        <NewProjectWizard
          onClose={() => setShowWizard(false)}
          onProjectCreated={(project) => {
            saveProject(project);
            setShowWizard(false);
            loadProject(project);
          }}
          onManual={() => setShowWizard(false)}
        />
      )}

      {/* ── event log panel ── */}
      {showLog && (
        <div className="yt-log-panel">
          <div className="yt-log-header">
            <span>📋 Event Log ({eventLog.length})</span>
            {gttsCount > 0 && (
              <span className="yt-gtts-usage" title={`Google TTS: ${gttsCount} calls, ~${gttsChars} chars`}>
                🌐 {gttsCount}× / ~{(gttsChars / 1000).toFixed(1)}k ch
              </span>
            )}
            <button className="yt-log-clear" onClick={() => setEventLog([])}>Clear</button>
            <button className="yt-log-close" onClick={() => setShowLog(false)}>✕</button>
          </div>
          <div className="yt-log-body">
            {eventLog.length === 0 && <div className="yt-log-empty">No events yet</div>}
            {eventLog.map((e, i) => (
              <div key={i} className={`yt-log-entry${e.type !== "info" ? ` yt-log-${e.type}` : ""}`}>
                <span className="yt-log-time">{e.time}</span>
                <span className="yt-log-msg">{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default YoutubeTranscriptParser;
