import React from 'react';
import Debug from './Debug';



interface FinalTranscriptHistory {
    finalTranscriptProxy: string; uuid: number; translation: string; fromLang: string; toLang: string;
}


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
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </Debug>
    );
};

export default TranscriptHistory;