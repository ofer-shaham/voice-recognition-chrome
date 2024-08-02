import React, { useMemo } from "react";
import { FinalTranscriptHistory } from "../../types/FinalTranscriptHistory";
import "../../styles/FinalTranscriptHistory.css";

type TranscriptHistoryProps = {
  finalTranscriptHistory: FinalTranscriptHistory[];
  onfreeSpeakOnly: (text: string, lang: string) => void;
  onBeforePlayback: () => void;
  onEndPlayback: () => void;
};

const TranscriptHistory: React.FC<TranscriptHistoryProps> = ({
  finalTranscriptHistory,
  onfreeSpeakOnly,
  onBeforePlayback,
  onEndPlayback,
}) => {
  const LIMIT_ARR_CUT_FINAL = 10;

  const languageColorMap = useMemo(() => {
    const colorPalette = [
      'color-1', 'color-2', 'color-3', 'color-4',
      'color-5', 'color-6', 'color-7', 'color-8'
    ];
    const map = new Map<string, string>();
    let colorIndex = 0;

    finalTranscriptHistory.forEach(item => {
      [item.fromLang, item.toLang].forEach(lang => {
        if (!map.has(lang)) {
          map.set(lang, colorPalette[colorIndex % colorPalette.length]);
          colorIndex++;
        }
      });
    });

    return map;
  }, [finalTranscriptHistory]);

  const getLanguageClass = (lang: string) => {
    return languageColorMap.get(lang) || 'color-default';
  };

  return finalTranscriptHistory.length ? (
    <div className="transcript-history">
      <p>conversation history:</p>
      <table>
        <tbody>
          {finalTranscriptHistory
            .slice(-LIMIT_ARR_CUT_FINAL)
            .reverse()
            .map((r) => (
              <tr key={r.uuid}>
                <td className={`lang-cell ${getLanguageClass(r.fromLang)}`}>
                  <button onClick={() => onfreeSpeakOnly(r.finalTranscriptProxy, r.fromLang)}>
                    <div>
                      <span className="lang-label">[{r.fromLang}]</span>
                      <span>{r.finalTranscriptProxy}</span>
                    </div>
                  </button>
                </td>
                <td className={`lang-cell ${getLanguageClass(r.toLang)}`}>
                  <button onClick={() => onfreeSpeakOnly(r.translation, r.toLang)}>
                    <div>
                      <span className="lang-label">[{r.toLang}]</span>
                      <span>{r.translation}</span>
                    </div>
                  </button>
                </td>
                {r.audioData && isBase64(r.audioData) ? (
                  <td className="audio-cell">
                    <audio
                      controls
                      src={`data:audio/webm;base64,${r.audioData}`}
                      onPlay={onBeforePlayback}
                      onEnded={onEndPlayback}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  ) : null;
};

export default TranscriptHistory;

function isBase64(str: string): boolean {
  if (str === "" || str.trim() === "") return false;
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}
