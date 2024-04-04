import React from 'react';

interface StartAndStopButtonsProps {
    listening: boolean;
    listenNow: () => void;
    resetTranscript: () => void;
    setFromLang: (lang: string) => void;
    setToLang: (lang: string) => void;
    setTranslation: (translation: string) => void;
    handleStopListening: () => void;
}

const StartAndStopButtons: React.FC<StartAndStopButtonsProps> = ({
    listening,
    listenNow,
    resetTranscript,
    setFromLang,
    setToLang,
    setTranslation,
    handleStopListening,
}) => {
    const handleResetLanguages = () => {
        setFromLang('en-US');
        setToLang('en-US');
        setTranslation('');
    };

    return (
        <div id="buttons" style={{ background: 'grey' }}>
            <div>
                <button disabled={!listening} onClick={handleStopListening}>
                    Stop
                </button>
                <button style={{ color: 'darkgreen' }} disabled={listening} onClick={listenNow}>
                    Start
                </button>
            </div>
            <div>
                <button onClick={handleResetLanguages}>reset languages</button>
                <button onClick={resetTranscript}>Reset Transcript</button>
            </div>
        </div>
    );
};

export default StartAndStopButtons;