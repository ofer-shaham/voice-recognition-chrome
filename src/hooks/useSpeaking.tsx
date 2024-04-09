import { useState, useEffect } from 'react';

export const useSpeechSynthesis = () => {
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        const speechSynthesisEventHandler = () => {
            setIsSpeaking(speechSynthesis.speaking);
        };

        speechSynthesis.addEventListener('start', speechSynthesisEventHandler);
        speechSynthesis.addEventListener('end', speechSynthesisEventHandler);

        return () => {
            speechSynthesis.removeEventListener('start', speechSynthesisEventHandler);
            speechSynthesis.removeEventListener('end', speechSynthesisEventHandler);
        };
    }, []);
    console.info({ isSpeaking })
    return isSpeaking;
};