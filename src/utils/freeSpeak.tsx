import { isMobile } from "../services/isMobile";
import { populateAvailableVoices } from "./getVoice";

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

const findVoice = (voices: SpeechSynthesisVoice[], lang: string, mobile: boolean): SpeechSynthesisVoice | null => {
    const normalizedLang = mobile ? lang.replace('-', '_') : lang;

    // Try exact match first
    const exact = voices.filter((v) => v.lang === normalizedLang);
    if (exact.length > 0) {
        // Prefer non-local voices for consistency
        const remote = exact.find((v) => !v.localService);
        return remote || exact[0];
    }

    // Try base language match (e.g. "en" for "en-US")
    const baseLang = normalizedLang.split(/[-_]/)[0];
    const baseMatch = voices.filter((v) => {
        const vBase = v.lang.split(/[-_]/)[0];
        return vBase.toLowerCase() === baseLang.toLowerCase();
    });
    if (baseMatch.length > 0) {
        const remote = baseMatch.find((v) => !v.localService);
        return remote || baseMatch[0];
    }

    return null;
};

export const freeSpeak = (text: string, toLang: string = 'en-US'): Promise<void> => {
    return new Promise(async (resolve: any, reject: any) => {
        // Cancel any ongoing speech first to avoid queue issues
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        // Always set lang explicitly — this is the primary language control
        utterance.lang = toLang;

        const voices = await loadVoices();
        populateAvailableVoices(voices);

        const voice = findVoice(voices, toLang, isMobile);
        if (!voice) {
            console.warn('no voice found for language, using browser default with lang set:', toLang);
        } else {
            utterance.voice = voice;
            // Re-assert lang after assigning voice — some browsers reset it
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
