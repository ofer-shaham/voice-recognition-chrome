import React, { useState, useEffect } from 'react';

interface SpeakLogProps {
    setSpeaking: React.Dispatch<React.SetStateAction<boolean>>;
    isSpeaking: boolean;
}

export const SpeakLog: React.FC<SpeakLogProps> = ({ setSpeaking, isSpeaking }) => {
    const [log, setLog] = useState<string[]>([]);

    useEffect(() => {
        const handleSpeakingChange = () => {
            setSpeaking(speechSynthesis.speaking);
        };

        const handleSpeakEvent = (event: SpeechSynthesisEvent) => {
            setSpeaking(speechSynthesis.speaking);

            const { charIndex, elapsedTime, type, name } = event;
            const logEntry = `[${name}: ${type}] Char Index: ${charIndex}, Elapsed Time: ${elapsedTime}`;
            setLog((prevLog) => [...prevLog, logEntry]);
            console.info(logEntry);
        };

        if ('speechSynthesis' in window) {
            speechSynthesis.addEventListener('voiceschanged', handleSpeakingChange);
            speechSynthesis.addEventListener('start', handleSpeakEvent as EventListener);
            speechSynthesis.addEventListener('end', handleSpeakEvent as EventListener);
            speechSynthesis.addEventListener('pause', handleSpeakEvent as EventListener);
            speechSynthesis.addEventListener('resume', handleSpeakEvent as EventListener);
            speechSynthesis.addEventListener('mark', handleSpeakEvent as EventListener);
            speechSynthesis.addEventListener('boundary', handleSpeakEvent as EventListener);

            return () => {
                speechSynthesis.removeEventListener('voiceschanged', handleSpeakingChange);
                speechSynthesis.removeEventListener('start', handleSpeakEvent as EventListener);
                speechSynthesis.removeEventListener('end', handleSpeakEvent as EventListener);
                speechSynthesis.removeEventListener('pause', handleSpeakEvent as EventListener);
                speechSynthesis.removeEventListener('resume', handleSpeakEvent as EventListener);
                speechSynthesis.removeEventListener('mark', handleSpeakEvent as EventListener);
                speechSynthesis.removeEventListener('boundary', handleSpeakEvent as EventListener);
            };
        }
    }, [setSpeaking, setLog]);

    return (
        <div>
            <h2>Speak Log</h2>
            {log.map((entry, index) => (
                <p key={index}>{entry}</p>
            ))}
        </div>
    );
};