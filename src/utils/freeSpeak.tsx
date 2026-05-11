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
        // Fallback: resolve with whatever is available after 2s
        setTimeout(() => {
            speechSynthesis.removeEventListener('voiceschanged', onChanged);
            resolve(speechSynthesis.getVoices());
        }, 2000);
    });
};

export const freeSpeak = (text: string, toLang: string = 'en-US'): Promise<void> => {
    console.log('freeSpeak', { text, toLang })
    return new Promise(async (resolve: any, reject: any) => {
        const utterance = new SpeechSynthesisUtterance(text);

        const voices = await loadVoices();
        populateAvailableVoices(voices);

        const voice = getVoice(toLang, isMobile)
        if (!voice) {
            console.warn('no voice found for language, using browser default:', toLang)
        } else {
            utterance.voice = voice;
        }
        utterance.lang = toLang;

        utterance.onerror = function (event: SpeechSynthesisErrorEvent) {
            console.error(
                `An error has occurred with the speech synthesis: ${event.error}`, { event }, { utterance }, { speechSynthesis }
            );
            reject(event.error)
        }
        utterance.onboundary = function (ev) { console.info('onboundary', { ev }) }
        utterance.onmark = function (ev) { console.info('onmark', { ev }) }
        utterance.onpause = function (ev) { console.info('onpause', { ev }) }
        utterance.onresume = function (ev) { console.info('onresume', { ev }) }
        utterance.onend = function (ev) {
            resolve()
        }
        try {
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error(e)
            reject('3.' + e)
        }
    })
}
