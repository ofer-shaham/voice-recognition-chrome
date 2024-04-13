import React from 'react';
import Debug from '../LogAndDebugComponents/Debug';

interface TranscriptOptionsProps {
    isModeDebug: boolean;
    isInterimResults: boolean;
    setIsInterimResults: React.Dispatch<React.SetStateAction<boolean>>;
    isContinuous: boolean;
    setIsContinuous: React.Dispatch<React.SetStateAction<boolean>>;
    allowRecording: boolean;
    setAllowRecording: React.Dispatch<React.SetStateAction<boolean>>;
}

const TranscriptOptions: React.FC<TranscriptOptionsProps> = ({
    isModeDebug,
    isInterimResults,
    setIsInterimResults,
    isContinuous,
    setIsContinuous,
    allowRecording,
    setAllowRecording
}) => {
    return (
        <Debug isModeDebug={isModeDebug}>
            <div>
                <label>
                    Interim Results:
                    <input
                        type="checkbox"
                        checked={isInterimResults}
                        onChange={() => setIsInterimResults(!isInterimResults)}
                    />
                </label>
                <br />
                <label>
                    Continuous:
                    <input
                        type="checkbox"
                        checked={isContinuous}
                        onChange={() => setIsContinuous(!isContinuous)}
                    />
                </label>                <br />
                <label>
                    Recording:
                    <input
                        type="checkbox"
                        checked={allowRecording}
                        onChange={() => setAllowRecording(!allowRecording)}
                    />
                </label>
                <br />
            </div>
        </Debug>
    );
};

export default TranscriptOptions;