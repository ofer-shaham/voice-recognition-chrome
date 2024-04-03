import { isMobile } from "../services/isMobile";
import { getVoice } from "./getVoice";

export const freeSpeech = (text: string, toLang: string = 'en-US'): Promise<void> => {
    console.log('freeSpeech', { text, toLang })
    return new Promise((resolve: any, reject: any) => {
        const utterance = new SpeechSynthesisUtterance(text);

        const voice = getVoice(toLang, isMobile)
        if (!voice) {
            console.warn('error - no voice found for language:', toLang)
        } else { utterance.voice = voice; }
        utterance.lang = toLang; //.replace('_', '-'); //TODO: may need to replace between _ ,-

        utterance.addEventListener("error", (event: SpeechSynthesisErrorEvent) => {
            console.log(
                `An error has occurred with the speech synthesis: ${event.error}`,
                event);
        });
        try {
            // utterance.onstart = function (ev) { setIsSpeaking(true) }
            utterance.onerror = function (event) {
                console.log(
                    `An error has occurred with the speech synthesis: ${event.error}`,
                );
                reject(event.error)
            }
            utterance.onboundary = function (ev) { console.info('onboundary', { ev }) }
            utterance.onmark = function (ev) { console.info('onmark', { ev }) }
            utterance.onpause = function (ev) { console.info('onpause', { ev }) }
            utterance.onresume = function (ev) { console.info('onresume', { ev }) }
            utterance.onend = function (ev) {
                // setIsSpeaking(false)
                resolve()
            }
            speechSynthesis.speak(utterance);
        } catch (e) {
            console.error(e)
            reject(e)
        }
    })
}
