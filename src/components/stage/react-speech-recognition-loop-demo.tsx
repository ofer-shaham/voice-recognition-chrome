import React, { useEffect, useState } from 'react';
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

    //set events handlers
    useRecognitionEvents(SpeechRecognition);


    useEffect(() => {
        const recognition = SpeechRecognition.getRecognition()

        const onEnd = (eventData: Event) => {
            console.log(`event occurred:`, eventData.type, eventData);
            SpeechRecognition.startListening()
        };

        recognition?.addEventListener('end', onEnd);
    }, [])

    if (!browserSupportsSpeechRecognition) {
        return <span>Browser doesn't support speech recognition.</span>;
    }

    return (
        <div>
            <p>Microphone: {listening ? 'on' : 'off'}</p>
            <button onClick={() => SpeechRecognition.startListening()}>Start</button>
            <button onClick={SpeechRecognition.stopListening}>Stop</button>
            <button onClick={resetTranscript}>Reset</button>
            <p>{transcript}</p>
            <Logger messages={logMessages} setMessages={setLogMessages} />
        </div>
    );
};
export default ExampleKit;
