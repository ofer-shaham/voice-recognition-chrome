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

function parseSrt(raw: string): { timestamp: string; text: string }[] {
  const blocks = raw.trim().split(/\n{2,}/);
  const result: { timestamp: string; text: string }[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;
    const timeLineIdx = lines.findIndex((l) =>
      /\d{1,2}:\d{2}/.test(l)
    );
    if (timeLineIdx === -1) continue;
    const timeLine = lines[timeLineIdx];
    const match = timeLine.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?)/);
    if (!match) continue;
    const timestamp = match[1].replace(",", ".");
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join(" ").trim();
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

function parseContent(raw: string): { timestamp: string; text: string }[] {
  if (/\d{1,2}:\d{2}:\d{2}[.,]\d+\s*-->/.test(raw)) return parseSrt(raw);
  if (/^\d{2}:\d{2}/.test(raw.trim())) return parseTimestampedTxt(raw);
  return parseSrt(raw);
}

function YoutubeTranscriptParser() {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlParam = searchParams.get("url");
  const fromLangParam = searchParams.get("fromLang");
  const toLangParam = searchParams.get("toLang");
  const videoIdParam = searchParams.get("videoId");

  const [inputTab, setInputTab] = useState<"url" | "paste">("url");
  const [srtUrl, setSrtUrl] = useState(urlParam || bookExample.url);
  const [pasteText, setPasteText] = useState("");
  const [fromLang, setFromLang] = useState(fromLangParam || bookExample.fromLang);
  const [toLang, setToLang] = useState(toLangParam || bookExample.toLang);
  const [videoId, setVideoId] = useState(videoIdParam || bookExample.videoId);
  const videoUrl = bookExample.videoUrl;

  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [playbackConfig, setPlaybackConfig] = useState<PlaybackConfig>({
    source: true,
    translation: false,
    video: false,
  });

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const stopRef = useRef(false);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [linesPerPage, setLinesPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil(lines.length / linesPerPage));

  const availableVoices = useAvailableVoices();

  useEffect(() => {
    if (availableVoices.length) populateAvailableVoices(availableVoices);
  }, [availableVoices]);

  useEffect(() => {
    setSearchParams({
      ...(srtUrl ? { url: srtUrl } : {}),
      fromLang,
      toLang,
      videoId,
    });
  }, [srtUrl, fromLang, toLang, videoId, setSearchParams]);

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
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  };

  const handlePasteLoad = () => {
    setLoadError("");
    if (!pasteText.trim()) { setLoadError("Paste some SRT content first"); return; }
    const parsed = parseContent(pasteText);
    if (!parsed.length) { setLoadError("No lines parsed — check format"); return; }
    setLines(buildLines(parsed));
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!lines.length) return;
    const start = (currentPage - 1) * linesPerPage;
    const end = start + linesPerPage;
    const toTranslate = lines.slice(start, end).filter((l) => !l.translated);
    if (!toTranslate.length) return;

    Promise.all(
      toTranslate.map(async (line) => {
        const translation = await translate({
          finalTranscriptProxy: line.text,
          fromLang: line.fromLang,
          toLang: line.toLang,
        });
        return { text: line.text, translation };
      })
    ).then((results) => {
      setLines((prev) => {
        const next = [...prev];
        for (const r of results) {
          const idx = next.findIndex((l) => l.text === r.text && !l.translated);
          if (idx !== -1) {
            next[idx] = { ...next[idx], translation: r.translation, translated: true };
          }
        }
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, linesPerPage, lines.length, toLang]);

  const speakText = (text: string, lang: string): Promise<void> =>
    new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.lang = lang;
      utt.onend = () => resolve();
      utt.onerror = () => resolve();
      window.speechSynthesis.speak(utt);
    });

  const getStopTime = useCallback((index: number): string => {
    if (index + 1 < lines.length) return lines[index + 1].timestamp;
    return "99:99:99";
  }, [lines]);

  const playFromLine = useCallback(
    async (startIdx: number) => {
      if (playingRef.current) {
        stopRef.current = true;
        window.speechSynthesis.cancel();
        await new Promise((r) => setTimeout(r, 200));
      }
      stopRef.current = false;
      playingRef.current = true;
      setIsPlaying(true);

      for (let i = startIdx; i < lines.length; i++) {
        if (stopRef.current) break;
        setPlayingIndex(i);

        const page = Math.floor(i / linesPerPage) + 1;
        setCurrentPage(page);

        if (playbackConfig.source) {
          await speakText(lines[i].text, lines[i].fromLang);
          if (stopRef.current) break;
        }

        if (playbackConfig.translation && lines[i].translation) {
          await speakText(lines[i].translation, lines[i].toLang);
          if (stopRef.current) break;
        }

        if (playbackConfig.video) {
          const startSec = convertTimeToSeconds(lines[i].timestamp);
          const stopSec = convertTimeToSeconds(getStopTime(i));
          const duration = (stopSec - startSec) * 1000;
          if (duration > 0) await new Promise((r) => setTimeout(r, duration));
          if (stopRef.current) break;
        }
      }

      playingRef.current = false;
      setIsPlaying(false);
      setPlayingIndex(null);
    },
    [lines, playbackConfig, linesPerPage, getStopTime]
  );

  const stopPlayback = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setPlayingIndex(null);
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
      {/* ── header ── */}
      <div className="yt-header">
        <h2 className="yt-title">📺 YouTube SRT Player</h2>
        <div className="yt-playback-config">
          <span className="yt-config-label">Play columns:</span>
          {(["source", "translation", "video"] as PlayCol[]).map((col) => (
            <label key={col} className={`yt-col-toggle${playbackConfig[col] ? " active" : ""}`}>
              <input
                type="checkbox"
                checked={playbackConfig[col]}
                onChange={() => toggleCol(col)}
              />
              {col === "source" ? "🔊 Source" : col === "translation" ? "📝 Translation" : "🎬 Video"}
            </label>
          ))}
        </div>
        {isPlaying && (
          <button className="yt-stop-btn" onClick={stopPlayback}>■ Stop</button>
        )}
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
          <div className="yt-field-group">
            <label className="yt-field-label">YouTube ID</label>
            <input
              className="yt-select"
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              placeholder="dQw4w9WgXcQ"
            />
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
                  {playbackConfig.video && <th className="yt-th-video">
                    Video {playbackConfig.video && <span className="yt-col-badge">🎬</span>}
                  </th>}
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
                      {playbackConfig.video && (
                        <td className="yt-td-video" onClick={(e) => e.stopPropagation()}>
                          {line.timestamp ? (
                            <details className="yt-video-details">
                              <summary className="yt-video-summary">
                                {line.timestamp} → {getStopTime(gi)}
                              </summary>
                              <YouTubePlayer
                                videoUrl={videoUrl}
                                videoId={videoId}
                                startTime={line.timestamp}
                                stopTime={getStopTime(gi)}
                              />
                            </details>
                          ) : null}
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
    </div>
  );
}

export default YoutubeTranscriptParser;
