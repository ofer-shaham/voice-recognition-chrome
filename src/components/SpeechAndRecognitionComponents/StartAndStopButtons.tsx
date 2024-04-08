import React from 'react';

interface StartAndStopButtonsProps {
    listening: boolean;
    startListen: () => void;
    resetTranscript: () => void;
    setFromLang: (lang: string) => void;
    setToLang: (lang: string) => void;
    setTranslation: (translation: string) => void;
    handleStopListening: () => void;
    isRecording: boolean;
    setIsRecording: (record: boolean) => void;
}

const StartAndStopButtons: React.FC<StartAndStopButtonsProps> = ({
    listening,
    startListen,
    resetTranscript,
    setFromLang,
    setToLang,
    setTranslation,
    handleStopListening,
    isRecording,
    setIsRecording
}) => {
    const handleResetLanguages = () => {
        setFromLang('en-US');
        setToLang('en-US');
        setTranslation('');
    };

    return (
        <div id="buttons" style={{ background: 'grey' }}>
            <div>
                <button onClick={() => setIsRecording(!isRecording)}>
                    Recording {isRecording ? 'yes' : 'no'}
                </button>
                <button onClick={listening ? handleStopListening : startListen}>
                    Listening {listening ? 'yes' : 'no'}
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