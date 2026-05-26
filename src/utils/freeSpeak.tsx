import { isMobile } from "../services/isMobile";
import { populateAvailableVoices } from "./getVoice";

export const loadVoices = (): Promise<SpeechSynthesisVoice[]> => {
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

export const findVoice = (voices: SpeechSynthesisVoice[], lang: string, mobile: boolean): SpeechSynthesisVoice | null => {
    const normalizedLang = mobile ? lang.replace('-', '_') : lang;

    const exact = voices.filter((v) => v.lang === normalizedLang || v.lang.replace('_', '-') === lang);
    if (exact.length > 0) {
        const remote = exact.find((v) => !v.localService);
        return remote || exact[0];
    }

    const baseLang = lang.split(/[-_]/)[0].toLowerCase();
    const baseMatch = voices.filter((v) => {
        const vBase = v.lang.split(/[-_]/)[0];
        return vBase.toLowerCase() === baseLang;
    });
    if (baseMatch.length > 0) {
        const remote = baseMatch.find((v) => !v.localService);
        return remote || baseMatch[0];
    }

    return null;
};

export const freeSpeak = (text: string, toLang: string = 'en-US', rate: number = 1.0, voiceName?: string): Promise<void> => {
    return new Promise(async (resolve: any, reject: any) => {
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = toLang;
        utterance.rate = Math.max(0.1, Math.min(10, rate));

        const voices = await loadVoices();
        populateAvailableVoices(voices);

        let voice: SpeechSynthesisVoice | null = null;
        if (voiceName) {
            voice = voices.find((v) => v.name === voiceName) ?? null;
        }
        if (!voice) {
            voice = findVoice(voices, toLang, isMobile);
        }
        if (!voice) {
            console.warn('no voice found for language, using browser default with lang set:', toLang);
        } else {
            utterance.voice = voice;
            utterance.lang = toLang;
        }

        utterance.onerror = function (event: SpeechSynthesisErrorEvent) {
            console.error(`Speech synthesis error: ${event.error}`, { event });
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
