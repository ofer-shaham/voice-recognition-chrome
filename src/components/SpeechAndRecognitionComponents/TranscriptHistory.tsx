import React from 'react';
import { FinalTranscriptHistory } from '../../types/FinalTranscriptHistory';

type TranscriptHistoryProps = {
    finalTranscriptHistory: FinalTranscriptHistory[];
    onfreeSpeak: (text: string, lang: string) => void;
};

const TranscriptHistory: React.FC<TranscriptHistoryProps> = ({ finalTranscriptHistory, onfreeSpeak }) => {
    const LIMIT_ARR_CUT_FINAL = 10; // Define your desired limit for displaying transcript history

    return (
        <div>
            <p>finalTranscriptHistory</p>
            <table style={{ width: '100%' }}>
                <tbody>
                    {finalTranscriptHistory
                        .slice(-LIMIT_ARR_CUT_FINAL)
                        .reverse()
                        .map((r, i) => (
                            <tr key={r.uuid} style={{ marginBottom: '10px' }}> {/* Add margin bottom for vertical space */}
                                <td style={{ background: 'red', display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        style={{ width: '100%', padding: '5px' }}
                                        onClick={() => onfreeSpeak(r.finalTranscriptProxy, r.fromLang)}
                                    >
                                        <span style={{ flex: 1, textAlign: 'left' }}>[{r.fromLang}]</span>
                                        <span style={{ flex: 2 }}>{r.finalTranscriptProxy}</span>
                                    </button>
                                </td>
                                <td style={{ background: 'green', display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        style={{ width: '100%', padding: '5px' }}
                                        onClick={() => onfreeSpeak(r.translation, r.toLang)}
                                    >
                                        <span style={{ flex: 1, textAlign: 'left' }}>[{r.toLang}]</span>
                                        <span style={{ flex: 2 }}>{r.translation}</span>
                                    </button>
                                </td>
                                <td style={{ background: 'blue', width: '10%' }}>
                                    {r.audioData && (!isBase64(r.audioData) ?
                                        <p>{r.audioData}</p>
                                        : <audio controls src={`data:audio/webm;base64,${r.audioData}`} />)}
                                </td>
                            </tr>
                        ))}
                </tbody>
            </table>
        </div>
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
