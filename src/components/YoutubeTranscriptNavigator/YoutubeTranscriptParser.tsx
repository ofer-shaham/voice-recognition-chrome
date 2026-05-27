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

type PlayCol = "source" | "translation" | "video";

interface PlaybackConfig {
  source: boolean;
  translation: boolean;
  video: boolean;
}

interface LogEntry {
  time: string;
  msg: string;
  type: "info" | "warn" | "error";
}

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

function YoutubeTranscriptParser() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlParam = searchParams.get("url");
  const fromLangParam = searchParams.get("fromLang");
  const toLangParam = searchParams.get("toLang");
  const videoUrlParam = searchParams.get("videoUrl");

  const [inputTab, setInputTab] = useState<"url" | "paste">("url");
  const [srtUrl, setSrtUrl] = useState(urlParam || bookExample.url);
  const [pasteText, setPasteText] = useState("");
  const [fromLang, setFromLang] = useState(fromLangParam || bookExample.fromLang);
  const [toLang, setToLang] = useState(toLangParam || bookExample.toLang);
  const [videoUrl, setVideoUrl] = useState(videoUrlParam || bookExample.videoUrl);
  const videoId = extractVideoId(videoUrl);

  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [playbackConfig, setPlaybackConfig] = useState<PlaybackConfig>({
    source: true,
    translation: false,
    video: false,
  });

  const [ttsRateSource, setTtsRateSource] = useState(1.0);
  const [ttsRateTrans, setTtsRateTrans] = useState(1.0);
  const [showThumbnails, setShowThumbnails] = useState(false);

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const stopRef = useRef(false);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [linesPerPage, setLinesPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

  const [eventLog, setEventLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);

  const availableVoices = useAvailableVoices();

  useEffect(() => {
    if (availableVoices.length) populateAvailableVoices(availableVoices);
  }, [availableVoices]);

  useEffect(() => {
    setSearchParams({
      ...(srtUrl ? { url: srtUrl } : {}),
      fromLang,
      toLang,
      videoUrl,
    });
  }, [srtUrl, fromLang, toLang, videoUrl, setSearchParams]);

  const logEvent = useCallback((msg: string, type: LogEntry["type"] = "info") => {
    setEventLog((prev) => [{ time: nowTs(), msg, type }, ...prev].slice(0, 200));
  }, []);

  const buildLines = useCallback(
    (parsed: { timestamp: string; text: string }[]): TranscriptLine[] =>
      parsed.map((p) => ({
        text: p.text,
        translation: "",
        fromLang,
        toLang,
        translated: false,
        timestamp: p.timestamp,
      })),
    [fromLang, toLang]
  );

  const handleLoad = () => {
    setLoadError("");
    setLines([]);
    setLoading(true);
    logEvent(`Loading SRT: ${srtUrl}`);
    fetch(srtUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ct = r.headers.get("Content-Type") || "";
        if (ct.includes("text/html")) throw new Error("Got HTML, not SRT");
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
    setLines(buildLines(parsed));
    setCurrentPage(1);
    logEvent(`Pasted ${parsed.length} lines`);
  };

  // Translate only visible lines; use index as cache key to avoid text collisions
  useEffect(() => {
    if (!lines.length) return;
    const start = (currentPage - 1) * linesPerPage;
    const end = Math.min(start + linesPerPage, lines.length);
    const jobs = lines
      .slice(start, end)
      .map((l, vi) => ({ line: l, gi: start + vi }))
      .filter(({ line }) => !line.translated);

    if (!jobs.length) return;

    logEvent(`Translating ${jobs.length} visible line(s) (page ${currentPage})`);

    Promise.all(
      jobs.map(async ({ line, gi }) => {
        const translation = await translate({
          finalTranscriptProxy: line.text,
          fromLang: line.fromLang,
          toLang: line.toLang,
        });
        return { gi, translation };
      })
    ).then((results) => {
      setLines((prev) => {
        const next = [...prev];
        for (const { gi, translation } of results) {
          next[gi] = { ...next[gi], translation, translated: true };
        }
        return next;
      });
      logEvent(`Translation done for ${results.length} line(s)`);
    }).catch((e) => logEvent(`Translation error: ${e.message}`, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, linesPerPage, lines.length, toLang]);

  // Robust speakText: fixes Chrome ~15s pause bug with a resume interval
  const speakText = useCallback(
    (text: string, lang: string, rate: number): Promise<void> =>
      new Promise((resolve) => {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = lang;
        utt.rate = rate;
        // Chrome bug workaround: resume every 5s to prevent silent pause
        const resumeTimer = setInterval(() => {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 5000);
        const cleanup = () => { clearInterval(resumeTimer); resolve(); };
        utt.onend = cleanup;
        utt.onerror = (e) => {
          logEvent(`TTS error [${lang}]: ${e.error}`, "warn");
          cleanup();
        };
        // Small delay after cancel so Chrome processes it before the new utt
        setTimeout(() => window.speechSynthesis.speak(utt), 60);
      }),
    [logEvent]
  );

  const getStopTime = useCallback((index: number): string => {
    if (index + 1 < lines.length) return lines[index + 1].timestamp;
    return "99:99:99";
  }, [lines]);

  const playFromLine = useCallback(
    async (startIdx: number) => {
      if (playingRef.current) {
        stopRef.current = true;
        window.speechSynthesis.cancel();
        logEvent("Stopping previous playback");
        await new Promise((r) => setTimeout(r, 250));
      }
      stopRef.current = false;
      playingRef.current = true;
      setIsPlaying(true);
      logEvent(`▶ Playback start from line ${startIdx + 1}`);

      for (let i = startIdx; i < lines.length; i++) {
        if (stopRef.current) break;
        setPlayingIndex(i);

        const page = Math.floor(i / linesPerPage) + 1;
        setCurrentPage(page);
        logEvent(`Line ${i + 1} [${lines[i].timestamp}]: "${lines[i].text.slice(0, 40)}…"`);

        if (playbackConfig.source) {
          logEvent(`  TTS source → lang=${lines[i].fromLang} rate=${ttsRateSource}`);
          await speakText(lines[i].text, lines[i].fromLang, ttsRateSource);
          if (stopRef.current) break;
          logEvent(`  TTS source done`);
        }

        if (playbackConfig.translation && lines[i].translation) {
          logEvent(`  TTS translation → lang=${lines[i].toLang} rate=${ttsRateTrans}`);
          await speakText(lines[i].translation, lines[i].toLang, ttsRateTrans);
          if (stopRef.current) break;
          logEvent(`  TTS translation done`);
        }

        if (playbackConfig.video) {
          const startSec = convertTimeToSeconds(lines[i].timestamp);
          const stopSec = convertTimeToSeconds(getStopTime(i));
          const duration = Math.max(0, (stopSec - startSec) * 1000);
          logEvent(`  Video segment: ${lines[i].timestamp} → ${getStopTime(i)} (${(duration / 1000).toFixed(1)}s)`);
          if (duration > 0) await new Promise((r) => setTimeout(r, duration));
          if (stopRef.current) break;
        }
      }

      playingRef.current = false;
      setIsPlaying(false);
      setPlayingIndex(null);
      logEvent(stopRef.current ? "■ Playback stopped" : "✓ Playback complete");
    },
    [lines, playbackConfig, linesPerPage, getStopTime, speakText, ttsRateSource, ttsRateTrans, logEvent]
  );

  const stopPlayback = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setPlayingIndex(null);
    logEvent("■ Stop pressed");
  };

  const toggleCol = (col: PlayCol) =>
    setPlaybackConfig((p) => ({ ...p, [col]: !p[col] }));

  const visibleLines = lines.slice(
    (currentPage - 1) * linesPerPage,
    currentPage * linesPerPage
  );

  const fromRtl = isRtl(fromLang);
  const toRtl = isRtl(toLang);

  return (
    <div className="yt-page">
      {/* ── sticky header ── */}
      <div className="yt-header">
        <h2 className="yt-title">📺 YouTube SRT Player</h2>

        {/* Column playback toggles */}
        <div className="yt-playback-config">
          <span className="yt-config-label">Play:</span>
          {(["source", "translation", "video"] as PlayCol[]).map((col) => (
            <label key={col} className={`yt-col-toggle${playbackConfig[col] ? " active" : ""}`}>
              <input type="checkbox" checked={playbackConfig[col]} onChange={() => toggleCol(col)} />
              {col === "source" ? "🔊 Source" : col === "translation" ? "📝 Trans" : "🎬 Video"}
            </label>
          ))}
        </div>

        {/* TTS speed controls */}
        <div className="yt-rate-controls">
          <span className="yt-config-label">Speed:</span>
          <label className="yt-rate-label">
            Src
            <input
              type="range" min={0.5} max={2} step={0.1}
              value={ttsRateSource}
              onChange={(e) => setTtsRateSource(Number(e.target.value))}
              className="yt-rate-slider"
            />
            <span className="yt-rate-val">{ttsRateSource.toFixed(1)}×</span>
          </label>
          <label className="yt-rate-label">
            Trans
            <input
              type="range" min={0.5} max={2} step={0.1}
              value={ttsRateTrans}
              onChange={(e) => setTtsRateTrans(Number(e.target.value))}
              className="yt-rate-slider"
            />
            <span className="yt-rate-val">{ttsRateTrans.toFixed(1)}×</span>
          </label>
        </div>

        {/* Thumbnail & log toggles */}
        <div className="yt-header-actions">
          <button
            className={`yt-icon-btn${showThumbnails ? " active" : ""}`}
            onClick={() => setShowThumbnails((v) => !v)}
            title="Toggle video thumbnails in table"
          >🖼 Thumbs</button>
          <button
            className={`yt-icon-btn${showLog ? " active" : ""}`}
            onClick={() => setShowLog((v) => !v)}
            title="Toggle event log"
          >📋 Log{eventLog.length > 0 ? ` (${eventLog.length})` : ""}</button>
          {isPlaying && (
            <button className="yt-stop-btn" onClick={stopPlayback}>■ Stop</button>
          )}
        </div>
      </div>

      {/* ── input card ── */}
      <div className="yt-input-card">
        <div className="yt-tabs">
          <button
            className={`yt-tab${inputTab === "url" ? " active" : ""}`}
            onClick={() => setInputTab("url")}
          >🔗 URL</button>
          <button
            className={`yt-tab${inputTab === "paste" ? " active" : ""}`}
            onClick={() => setInputTab("paste")}
          >📋 Paste SRT</button>
        </div>

        {inputTab === "url" ? (
          <div className="yt-url-row">
            <input
              className="yt-url-input"
              type="text"
              value={srtUrl}
              onChange={(e) => setSrtUrl(e.target.value)}
              placeholder="https://example.com/subtitles.srt"
            />
            <button className="yt-load-btn" onClick={handleLoad} disabled={loading}>
              {loading ? "Loading…" : "Load"}
            </button>
          </div>
        ) : (
          <div className="yt-paste-area">
            <textarea
              className="yt-paste-textarea"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Paste SRT content here…\n\n1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:04,500 --> 00:00:07,000\nHow are you?"}
              rows={8}
            />
            <button className="yt-load-btn" onClick={handlePasteLoad}>Parse</button>
          </div>
        )}

        <div className="yt-meta-row">
          <div className="yt-field-group">
            <label className="yt-field-label">Source lang</label>
            <select className="yt-select" value={fromLang} onChange={(e) => setFromLang(e.target.value)}>
              {LANG_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="yt-field-group">
            <label className="yt-field-label">Translate to</label>
            <select className="yt-select" value={toLang} onChange={(e) => setToLang(e.target.value)}>
              {LANG_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="yt-field-group yt-field-group--wide">
            <label className="yt-field-label">YouTube URL or ID</label>
            <input
              className="yt-select"
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or video ID"
            />
            {videoId && videoId !== videoUrl && (
              <span className="yt-video-id-hint">ID: {videoId}</span>
            )}
          </div>
          <div className="yt-field-group">
            <label className="yt-field-label">Lines / page</label>
            <input
              className="yt-select"
              type="number"
              min={1}
              max={MAX_LINES}
              value={linesPerPage}
              onChange={(e) => setLinesPerPage(Math.min(MAX_LINES, Math.max(1, Number(e.target.value))))}
            />
          </div>
        </div>

        {loadError && <div className="yt-error">⚠ {loadError}</div>}
      </div>

      {/* ── table ── */}
      {lines.length > 0 && (
        <>
          <div className="yt-table-wrap">
            <table className="yt-table">
              <thead>
                <tr>
                  <th className="yt-th-num">#</th>
                  <th className="yt-th-time">Time</th>
                  <th className={`yt-th-text${fromRtl ? " rtl" : ""}`}>
                    {LANG_OPTIONS.find((l) => l.code === fromLang)?.label ?? fromLang}
                    {playbackConfig.source && <span className="yt-col-badge">🔊</span>}
                  </th>
                  <th className={`yt-th-text${toRtl ? " rtl" : ""}`}>
                    {LANG_OPTIONS.find((l) => l.code === toLang)?.label ?? toLang}
                    {playbackConfig.translation && <span className="yt-col-badge">🔊</span>}
                  </th>
                  {playbackConfig.video && (
                    <th className="yt-th-video">
                      🎬 Video
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visibleLines.map((line, vi) => {
                  const gi = (currentPage - 1) * linesPerPage + vi;
                  const isActive = playingIndex === gi;
                  const isSelected = selectedLine === gi;
                  return (
                    <tr
                      key={gi}
                      className={`yt-row${isActive ? " yt-row-playing" : ""}${isSelected ? " yt-row-selected" : ""}`}
                      onClick={() => {
                        setSelectedLine(gi);
                        playFromLine(gi);
                      }}
                      title="Click to play from this line"
                    >
                      <td className="yt-td-num">{gi + 1}</td>
                      <td className="yt-td-time">{line.timestamp}</td>
                      <td className={`yt-td-text${fromRtl ? " rtl" : ""}`}>
                        <span className={isActive && playbackConfig.source ? "yt-speaking" : ""}>{line.text}</span>
                        <button
                          className="yt-speak-btn"
                          title="Speak source"
                          onClick={(e) => { e.stopPropagation(); freeSpeak(line.text, line.fromLang); }}
                        >🔊</button>
                      </td>
                      <td className={`yt-td-text${toRtl ? " rtl" : ""}`}>
                        {line.translated ? (
                          <>
                            <span className={isActive && playbackConfig.translation ? "yt-speaking" : ""}>{line.translation}</span>
                            <button
                              className="yt-speak-btn"
                              title="Speak translation"
                              onClick={(e) => { e.stopPropagation(); freeSpeak(line.translation, line.toLang); }}
                            >🔊</button>
                          </>
                        ) : (
                          <span className="yt-translating">translating…</span>
                        )}
                      </td>

                      {/* Video column — only mount the iframe for the ACTIVE row to prevent
                          all iframes from autoplaying simultaneously */}
                      {playbackConfig.video && (
                        <td className="yt-td-video" onClick={(e) => e.stopPropagation()}>
                          {isActive ? (
                            <YouTubePlayer
                              videoId={videoId}
                              startTime={line.timestamp}
                              stopTime={getStopTime(gi)}
                              autoplay
                            />
                          ) : showThumbnails ? (
                            <YouTubePlayer
                              videoId={videoId}
                              startTime={line.timestamp}
                              stopTime={getStopTime(gi)}
                              thumbnail
                            />
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
            <button
              className="yt-page-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >◀ Prev</button>
            <span className="yt-page-info">
              Page {currentPage} / {totalPages}
              <span className="yt-line-count"> ({lines.length} lines)</span>
            </span>
            <button
              className="yt-page-btn"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >Next ▶</button>
          </div>
        </>
      )}

      {!lines.length && !loading && (
        <div className="yt-empty">
          <div className="yt-empty-icon">📄</div>
          <p>Load an SRT file or paste SRT content to get started.</p>
          <p className="yt-empty-sub">Click a row to play from that line. Use the column toggles to choose what gets played.</p>
        </div>
      )}

      {/* ── event log panel ── */}
      {showLog && (
        <div className="yt-log-panel">
          <div className="yt-log-header">
            <span>Event Log</span>
            <button className="yt-log-clear" onClick={() => setEventLog([])}>Clear</button>
            <button className="yt-log-close" onClick={() => setShowLog(false)}>✕</button>
          </div>
          <div className="yt-log-body">
            {eventLog.length === 0 && <div className="yt-log-empty">No events yet.</div>}
            {eventLog.map((e, i) => (
              <div key={i} className={`yt-log-entry yt-log-${e.type}`}>
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
