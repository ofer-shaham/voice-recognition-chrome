import React from 'react';
import Debug from '../../Debug';



interface TranscriptLiveProps {
    isModeDebug: boolean;
    finalTranscript: string;
    transcript: string;
    interimTranscript: string;
}

const TranscriptLive: React.FC<TranscriptLiveProps> = ({
    isModeDebug,
    finalTranscript,
    transcript,
    interimTranscript,
}) => {
    return (
        <Debug isModeDebug={isModeDebug}>
            <div style={{ width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'left' }}>
                    <label style={{ marginRight: '10px', minWidth: '15%' }}>finalTranscript:</label>
                    <input type="text" value={finalTranscript} style={{ width: '100%' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'left' }}>
                    <label style={{ marginRight: '10px', minWidth: '15%' }}>transcript:</label>
                    <input type="text" value={transcript} style={{ width: '100%' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'left' }}>
                    <label style={{ marginRight: '10px', minWidth: '15%' }}>interimTranscript:</label>
                    <input type="text" value={interimTranscript} style={{ width: '100%' }} readOnly />
                </div>
            </div>
        </Debug >
    );
};

export default TranscriptLive;