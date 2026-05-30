import { useEffect, useState } from 'react';

export const useAvailableVoices = () => {
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        if (typeof speechSynthesis === 'undefined') return;

        const populateVoiceList = () => {
            const voices = speechSynthesis.getVoices();
            if (voices.length > 0) setAvailableVoices(voices);
        };

        populateVoiceList();
        speechSynthesis.addEventListener('voiceschanged', populateVoiceList);
        return () => speechSynthesis.removeEventListener('voiceschanged', populateVoiceList);
    }, []);

    return availableVoices;
};
