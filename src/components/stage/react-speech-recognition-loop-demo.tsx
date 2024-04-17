import React, { useCallback, useEffect, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useRecognitionEvents } from '../../hooks/useRecognitionEvents';
import { Logger } from '../LogAndDebugComponents/Logger';

const ExampleKit = () => {
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition();
    const [logMessages, setLogMessages] = useState<any[]>([]);
    const [continuous, setContinuous] = useState(true);
    const [interimResults, setInterimResults] = useState(false);
    const [language, setLanguage] = useState('en-US');

    // Set events handlers
    useRecognitionEvents(SpeechRecognition);

    useEffect(() => {
        const recognition = SpeechRecognition.getRecognition();

        const onEnd = (eventData: Event) => {
            console.log(`----------------onend---------------`, eventData.type, eventData);
            if (!continuous) {
                SpeechRecognition.startListening({ continuous, interimResults });
            }
        };
        const onStart = (eventData: Event) => {
            console.log(`----------------start---------------`, eventData.type, eventData);

        };
        const onError = (eventData: Event) => {
            console.log(`===================error---------------`, eventData.type, eventData);

        };

        recognition?.addEventListener('end', onEnd);
        recognition?.addEventListener('start', onStart);
        recognition?.addEventListener('error', onError);

        return () => {
            recognition?.removeEventListener('end', onEnd);
            recognition?.removeEventListener('start', onStart);
            recognition?.removeEventListener('error', onError);
        };
    }, [continuous, interimResults]);



    const handleStartListening = useCallback(() => {
        SpeechRecognition.startListening({ continuous, interimResults, language });
    }, [continuous, interimResults, language]);

    useEffect(() => {
        handleStartListening()
    }, [handleStartListening])

    if (!browserSupportsSpeechRecognition) {
        return <span style={{ color: 'red' }}>Browser doesn't support speech recognition.</span>;
    }
    return (
        <div>
            <p style={{ color: 'blue' }}>listening: {listening ? 'on' : 'off'}</p>
            <div>
                <label htmlFor="continuous">Continuous:</label>
                <input
                    id="continuous"
                    type="checkbox"
                    checked={continuous}
                    onChange={(e) => setContinuous(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="interimResults">Interim Results:</label>
                <input
                    id="interimResults"
                    type="checkbox"
                    checked={interimResults}
                    onChange={(e) => setInterimResults(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="language">Language:</label>
                <select
                    id="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                >
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Spanish</option>
                    <option value="he-IL">Hebrew</option>
                    {/* Add more language options here */}
                </select>
            </div>
            <button
                style={{ backgroundColor: 'green', color: 'white' }}
                disabled={listening}
                onClick={handleStartListening}
            >
                Start
            </button>
            <button
                style={{ backgroundColor: 'red', color: 'white' }}
                disabled={!listening}
                onClick={SpeechRecognition.stopListening}
            >
                Stop
            </button>
            <button
                style={{ backgroundColor: 'orange', color: 'white' }}
                onClick={resetTranscript}
            >
                Reset
            </button>
            <p style={{ color: 'purple' }}>{transcript}</p>
            <Logger messages={logMessages} setMessages={setLogMessages} />
        </div>
    );
};

export default ExampleKit;