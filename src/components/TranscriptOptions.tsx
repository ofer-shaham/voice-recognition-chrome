import React, { useState } from 'react';
import Debug from '../Debug';

interface TranscriptOptionsProps {
    isModeDebug: boolean;
}

const TranscriptOptions: React.FC<TranscriptOptionsProps> = ({ isModeDebug }) => {
    const [isInterimResults, setIsInterimResults] = useState<boolean>(false);
    const [isContinuous, setIsContinuous] = useState<boolean>(false);

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
                </label>
                <br />
            </div>
        </Debug>
    );
};

export default TranscriptOptions;