import React from 'react';
import Debug from '../LogAndDebugComponents/Debug';
import { FinalTranscriptHistory } from '../../types/FinalTranscriptHistory';






type TranscriptHistoryProps = {
    finalTranscriptHistory: FinalTranscriptHistory[];
    isModeDebug: boolean;
};

const TranscriptHistory: React.FC<TranscriptHistoryProps> = ({ finalTranscriptHistory, isModeDebug }) => {
    const LIMIT_ARR_CUT_FINAL = 10; // Define your desired limit for displaying transcript history

    return (
        <Debug isModeDebug={isModeDebug}>
            <div>
                <p>finalTranscriptHistory</p>
                <table>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>fromLang</th>
                            <th>toLang</th>
                            <th>finalTranscript</th>
                            <th>translation</th>
                            <th>audioData</th>
                        </tr>
                    </thead>
                    <tbody>
                        {finalTranscriptHistory
                            .slice(-LIMIT_ARR_CUT_FINAL)
                            .reverse()
                            .map((r, i) => (
                                <tr key={r.uuid}>
                                    <td>{r.uuid}</td>
                                    <td>{r.fromLang}</td>
                                    <td>{r.toLang}</td>
                                    <td>{r.finalTranscriptProxy}</td>
                                    <td>{r.translation}</td>
                                    <td>
                                        {r.audioData && <audio controls src={`data:audio/webm;base64,${r.audioData}`} />}
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </Debug>
    );
};

export default TranscriptHistory;