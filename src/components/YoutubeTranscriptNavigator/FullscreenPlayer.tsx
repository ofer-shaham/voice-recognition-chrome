import { useEffect, useRef, useState, useCallback } from "react";
import { convertTimeToSeconds } from "../../utils/YoutubeUtils";

interface TranscriptLine {
  text: string;
  translation: string;
  fromLang: string;
  toLang: string;
  translated: boolean;
  timestamp: string;
}

interface ExtraSrtCol {
  id: string;
  label: string;
  lang: string;
  texts: string[];
  visible: boolean;
  playEnabled: boolean;
}

type PlaybackConfig = { source: boolean; translation: boolean; video: boolean };

interface Props {
  videoId: string;
  lines: TranscriptLine[];
  extraCols: ExtraSrtCol[];
  playbackConfig: PlaybackConfig;
  playOrder: string[];
  ttsRateSource: number;
  ttsRateTrans: number;
  fromLang: string;
  toLang: string;
  availableVoices: SpeechSynthesisVoice[];
  startLineIndex: number;
  onClose: () => void;
  logEvent: (msg: string, type?: "info" | "warn" | "error") => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

// ── Load YouTube IFrame API ────────────────────────────────────────────────────
function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT?.Player) { resolve(); return; }
    const existing = document.getElementById("yt-iframe-api");
    if (!existing) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prev) prev();
      resolve();
    };
  });
}

// ── Word-highlight sub-component ──────────────────────────────────────────────
function WordHighlight({ text, charIndex, charLength }: { text: string; charIndex: number; charLength: number }) {
  if (!text || charLength === 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, charIndex)}
      <mark className="yt-word-highlight">{text.slice(charIndex, charIndex + charLength)}</mark>
      {text.slice(charIndex + charLength)}
    </>
  );
}

export default function FullscreenPlayer({
  videoId, lines, extraCols, playbackConfig, playOrder,
  ttsRateSource, ttsRateTrans, fromLang, toLang,
  availableVoices, startLineIndex, onClose, logEvent,
}: Props) {
  const playerDivRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const stopRef = useRef(false);
  const playingRef = useRef(false);

  const [currentIdx, setCurrentIdx] = useState(startLineIndex);
  const [phase, setPhase] = useState<"idle" | "video" | "tts" | "done">("idle");
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  const [activeWord, setActiveWord] = useState<{ gi: number; charIndex: number; charLength: number; col: string } | null>(null);
  const [statusMsg, setStatusMsg] = useState("Initialising player…");

  // Stable refs for playback loop
  const linesRef = useRef(lines);
  const extraColsRef = useRef(extraCols);
  const playOrderRef = useRef(playOrder);
  const configRef = useRef(playbackConfig);
  const rateSourceRef = useRef(ttsRateSource);
  const rateTransRef = useRef(ttsRateTrans);
  const voicesRef = useRef(availableVoices);

  useEffect(() => { linesRef.current = lines; }, [lines]);
  useEffect(() => { extraColsRef.current = extraCols; }, [extraCols]);
  useEffect(() => { playOrderRef.current = playOrder; }, [playOrder]);
  useEffect(() => { configRef.current = playbackConfig; }, [playbackConfig]);
  useEffect(() => { rateSourceRef.current = ttsRateSource; }, [ttsRateSource]);
  useEffect(() => { rateTransRef.current = ttsRateTrans; }, [ttsRateTrans]);
  useEffect(() => { voicesRef.current = availableVoices; }, [availableVoices]);

  // ── Initialise YouTube IFrame Player ─────────────────────────────────────
  useEffect(() => {
    let player: any = null;
    loadYTApi().then(() => {
      if (!playerDivRef.current) return;
      player = new window.YT.Player(playerDivRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, controls: 1 },
        events: {
          onReady: () => {
            playerRef.current = player;
            setPlayerReady(true);
            setStatusMsg("Player ready — press Play to start");
          },
          onError: (e: any) => {
            setStatusMsg(`Player error: ${e.data}`);
            logEvent(`FS Player error: ${e.data}`, "error");
          },
        },
      });
    });
    return () => {
      try { player?.destroy(); } catch { }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── speakText (mirrors parser's speakText) ────────────────────────────────
  const speakText = useCallback(
    (text: string, lang: string, rate: number, colId: string, gi: number): Promise<void> =>
      new Promise((resolve) => {
        if (stopRef.current) { resolve(); return; }
        window.speechSynthesis.cancel();
        setActiveWord(null);

        const voices = voicesRef.current;
        const baseLang = lang.split(/[-_]/)[0].toLowerCase();
        const voice =
          voices.find(v => v.lang === lang || v.lang.replace("_", "-") === lang) ||
          voices.find(v => v.lang.split(/[-_]/)[0].toLowerCase() === baseLang) ||
          null;

        if (!voice && voices.length > 0) {
          const shortLang = lang.split("-")[0];
          const url = `/api/tts?lang=${shortLang}&text=${encodeURIComponent(text.slice(0, 200))}`;
          const audio = new Audio(url);
          audio.playbackRate = Math.max(0.5, Math.min(4, rate));
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
          return;
        }

        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = lang;
        utt.rate = rate;
        if (voice) utt.voice = voice;

        utt.onboundary = (e: SpeechSynthesisEvent) => {
          if (e.name === "word") {
            setActiveWord({ gi, col: colId, charIndex: e.charIndex, charLength: (e as any).charLength ?? 0 });
          }
        };
        const timer = setInterval(() => {
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 5000);
        const cleanup = () => { clearInterval(timer); setActiveWord(null); resolve(); };
        utt.onend = cleanup;
        utt.onerror = cleanup;
        setTimeout(() => window.speechSynthesis.speak(utt), 60);
      }),
    []
  );

  // ── Wait for player to reach a time (polling rAF) ────────────────────────
  const waitUntilTime = useCallback((targetSec: number): Promise<void> =>
    new Promise((resolve) => {
      const check = () => {
        if (stopRef.current) { resolve(); return; }
        const player = playerRef.current;
        if (!player) { resolve(); return; }
        const cur = player.getCurrentTime?.() ?? 0;
        if (cur >= targetSec) { resolve(); return; }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }), []);

  // ── Main playback loop ────────────────────────────────────────────────────
  const runLoop = useCallback(async (fromIdx: number) => {
    if (playingRef.current) return;
    playingRef.current = true;
    stopRef.current = false;
    setIsPlaying(true);

    const ls = linesRef.current;
    const player = playerRef.current;
    if (!player) { playingRef.current = false; setIsPlaying(false); return; }

    for (let i = fromIdx; i < ls.length; i++) {
      if (stopRef.current) break;
      setCurrentIdx(i);

      const startSec = convertTimeToSeconds(ls[i].timestamp);
      const stopSec = i + 1 < ls.length
        ? convertTimeToSeconds(ls[i + 1].timestamp)
        : startSec + 5;

      // Walk the playOrder
      for (const step of playOrderRef.current) {
        if (stopRef.current) break;
        const cfg = configRef.current;

        if (step === "video" && cfg.video) {
          setPhase("video");
          setStatusMsg(`▶ Video  ${ls[i].timestamp}`);
          player.seekTo(startSec, true);
          player.playVideo();
          await waitUntilTime(stopSec);
          player.pauseVideo();
          setPhase("tts");

        } else if (step === "source" && cfg.source) {
          setPhase("tts");
          setStatusMsg(`🔊 Source  line ${i + 1}`);
          await speakText(ls[i].text, ls[i].fromLang, rateSourceRef.current, "source", i);

        } else if (step === "translation" && cfg.translation && ls[i].translation) {
          setPhase("tts");
          setStatusMsg(`🔊 Translation  line ${i + 1}`);
          await speakText(ls[i].translation, ls[i].toLang, rateTransRef.current, "translation", i);

        } else {
          const col = extraColsRef.current.find(c => c.id === step);
          if (col?.playEnabled) {
            const txt = col.texts[i];
            if (txt) {
              setPhase("tts");
              setStatusMsg(`🔊 ${col.label}  line ${i + 1}`);
              await speakText(txt, col.lang, rateSourceRef.current, col.id, i);
            }
          }
        }
      }
    }

    playingRef.current = false;
    setIsPlaying(false);
    setPhase("done");
    setStatusMsg(stopRef.current ? "■ Stopped" : "✓ Playback complete");
  }, [speakText, waitUntilTime]);

  const handlePlay = () => {
    if (isPlaying) return;
    runLoop(currentIdx);
  };

  const handleStop = () => {
    stopRef.current = true;
    window.speechSynthesis.cancel();
    playerRef.current?.pauseVideo();
    setIsPlaying(false);
    setPhase("idle");
    setStatusMsg("Stopped");
  };

  const handleRestart = () => {
    handleStop();
    setTimeout(() => { setCurrentIdx(startLineIndex); setPhase("idle"); setStatusMsg("Ready"); }, 200);
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { handleStop(); onClose(); } };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const line = lines[currentIdx];
  const pct = lines.length > 0 ? ((currentIdx + 1) / lines.length) * 100 : 0;

  return (
    <div className="yt-fs-overlay">
      {/* ── Video ── */}
      <div className="yt-fs-video-wrap">
        <div ref={playerDivRef} className="yt-fs-player-inner" />
      </div>

      {/* ── HUD ── */}
      <div className="yt-fs-hud">

        {/* Progress bar */}
        <div className="yt-fs-progress-bar">
          <div className="yt-fs-progress-fill" style={{ width: `${pct}%` }} />
        </div>

        {/* Current line text */}
        {line && (
          <div className="yt-fs-lines">
            {playbackConfig.source && (
              <div className="yt-fs-line yt-fs-line-source" dir={line.fromLang.startsWith("he") || line.fromLang.startsWith("ar") ? "rtl" : "ltr"}>
                {activeWord?.gi === currentIdx && activeWord?.col === "source"
                  ? <WordHighlight text={line.text} charIndex={activeWord.charIndex} charLength={activeWord.charLength} />
                  : line.text}
              </div>
            )}
            {playbackConfig.translation && line.translated && (
              <div className="yt-fs-line yt-fs-line-trans" dir={toLang.startsWith("he") || toLang.startsWith("ar") ? "rtl" : "ltr"}>
                {activeWord?.gi === currentIdx && activeWord?.col === "translation"
                  ? <WordHighlight text={line.translation} charIndex={activeWord.charIndex} charLength={activeWord.charLength} />
                  : line.translation}
              </div>
            )}
            {extraCols.filter(c => c.visible && c.playEnabled).map(col => {
              const txt = col.texts[currentIdx];
              if (!txt) return null;
              return (
                <div key={col.id} className="yt-fs-line yt-fs-line-extra">
                  {activeWord?.gi === currentIdx && activeWord?.col === col.id
                    ? <WordHighlight text={txt} charIndex={activeWord.charIndex} charLength={activeWord.charLength} />
                    : txt}
                </div>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="yt-fs-controls">
          <div className="yt-fs-status">{statusMsg}</div>
          <div className="yt-fs-btns">
            <button className="yt-fs-ctrl-btn" onClick={handleRestart} title="Restart from beginning">⏮</button>
            <button
              className="yt-fs-ctrl-btn" title="Previous line"
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={isPlaying}>◀</button>
            {isPlaying
              ? <button className="yt-fs-ctrl-btn yt-fs-stop-btn" onClick={handleStop}>■ Stop</button>
              : <button className="yt-fs-ctrl-btn yt-fs-play-btn" onClick={handlePlay} disabled={!playerReady}>▶ Play</button>
            }
            <button
              className="yt-fs-ctrl-btn" title="Next line"
              onClick={() => setCurrentIdx(i => Math.min(lines.length - 1, i + 1))}
              disabled={isPlaying}>▶</button>
            <span className="yt-fs-line-counter">
              {currentIdx + 1} / {lines.length}
            </span>
            <button className="yt-fs-close-btn" onClick={() => { handleStop(); onClose(); }}>✕ Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
