import { useEffect, useState } from 'react';

export const useAvailableVoices = () => {
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

    useEffect(() => {
        const populateVoiceList = () => {
            if (typeof speechSynthesis === 'undefined') {
                return;
            }

            const voices = speechSynthesis.getVoices();

            setAvailableVoices(voices);
        };


        if (
            typeof speechSynthesis !== 'undefined' &&
            speechSynthesis.onvoiceschanged !== undefined
        ) {
            speechSynthesis.onvoiceschanged = populateVoiceList;
        }
        populateVoiceList();

    }, []);

    return availableVoices;
};