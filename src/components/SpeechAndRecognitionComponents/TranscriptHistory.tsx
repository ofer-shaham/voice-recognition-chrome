import React from 'react';
import { FinalTranscriptHistory } from '../../types/FinalTranscriptHistory';

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
  const LIMIT_ARR_CUT_FINAL = 10; // Define your desired limit for displaying transcript history

  return (

    finalTranscriptHistory.length ? (<div>
      <p>conversation history:</p>
      <table style={{ width: '100%' }}>
        <tbody>
          {finalTranscriptHistory
            .slice(-LIMIT_ARR_CUT_FINAL)
            .reverse()
            .map((r, i) => (
              <React.Fragment key={r.uuid}>
                <tr style={{ marginBottom: '10px' }}>
                  {/* Add margin bottom for vertical space */}
                  <td
                    style={{
                      background: 'red',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      style={{ width: '100%', padding: '5px' }}
                      onClick={() => onfreeSpeakOnly(r.finalTranscriptProxy, r.fromLang)}
                    >
                      <div style={{ display: 'flex' }}>
                        <span style={{ flex: '20%', textAlign: 'right' }}>
                          [{r.fromLang}]
                        </span>
                        <span style={{ flex: '80%' }}>{r.finalTranscriptProxy}</span>
                      </div>
                    </button>
                  </td>
                  <td
                    style={{
                      background: 'green',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      style={{ width: '100%', padding: '5px' }}
                      onClick={() => onfreeSpeakOnly(r.translation, r.toLang)}
                    >
                      <div style={{ display: 'flex' }}>
                        <span style={{ flex: '20%', textAlign: 'right' }}>
                          [{r.toLang}]
                        </span>
                        <span style={{ flex: '80%' }}>{r.translation}</span>
                      </div>
                    </button>
                  </td>
                  {r.audioData && isBase64(r.audioData) ?
                    <td style={{ background: 'blue', width: '10%', maxWidth: '10%' }}>
                      <audio
                        controls
                        src={`data:audio/webm;base64,${r.audioData}`}
                        onPlay={onBeforePlayback}
                        onEnded={onEndPlayback}
                      />
                    </td>
                    : null}
                </tr>
              </React.Fragment>
            ))}
        </tbody>
      </table>
    </div>) : null

  );
};

export default TranscriptHistory;

function isBase64(str: string): boolean {
  if (str === '' || str.trim() === '') return false;
  try {
    return btoa(atob(str)) === str;
  } catch (err) {
    return false;
  }
}