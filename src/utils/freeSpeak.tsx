import { isMobile } from "../services/isMobile";
import { getVoice, populateAvailableVoices } from "./getVoice";

const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve(voices);
            return;
        }
        const onChanged = () => {
            const v = speechSynthesis.getVoices();
            if (v.length > 0) {
                speechSynthesis.removeEventListener('voiceschanged', onChanged);
                resolve(v);
            }
        };
        speechSynthesis.addEventListener('voiceschanged', onChanged);
        setTimeout(() => {
            speechSynthesis.removeEventListener('voiceschanged', onChanged);
            resolve(speechSynthesis.getVoices());
        }, 2000);
    });
};

export const freeSpeak = (text: string, toLang: string = 'en-US'): Promise<void> => {
    return new Promise(async (resolve: any, reject: any) => {
        const utterance = new SpeechSynthesisUtterance(text);

        // Set language first so the browser uses it even if no matching voice is found
        utterance.lang = toLang;

        const voices = await loadVoices();
        populateAvailableVoices(voices);

        const voice = getVoice(toLang, isMobile);
        if (!voice) {
            console.warn('no voice found for language, using browser default with lang set:', toLang);
        } else {
            utterance.voice = voice;
            // Re-assert lang after assigning voice, as some browsers reset it
            utterance.lang = toLang;
        }

        utterance.onerror = function (event: SpeechSynthesisErrorEvent) {
            console.error(
                `Speech synthesis error: ${event.error}`, { event }
            );
            reject(event.error);
        };
        utterance.onend = function () {
            resolve();
        };
        try {
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error(e);
            reject('3.' + e);
        }
    });
};
