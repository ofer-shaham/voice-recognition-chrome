import { useEffect } from "react";
import SpeechRecognition from 'react-speech-recognition'


export const useRecognitionEvents = (SpeechRecognition: SpeechRecognition) => {



    useEffect(() => {
        const recognition = SpeechRecognition.getRecognition()
        if (!recognition) { console.error('no recognition'); return }
        const onError = (event: SpeechRecognitionErrorEvent): void => {
            console.error({ status: 'error', errorCode: event.error });
        };
        const handleEvent = (eventData: SpeechRecognitionEvent) => {
            console.log(`event occurred:`, eventData.type, eventData);
        };
        const handleEvent2 = (eventData: Event) => {
            console.log(`event occurred:`, eventData.type, eventData);
        };

        // @ts-ignore: refer to the top `wrong SpeechRecognition-related types` comments
        recognition.addEventListener('error', onError);
        recognition.addEventListener('audiostart', handleEvent2);
        recognition.addEventListener('soundstart', handleEvent2);
        recognition.addEventListener('speechstart', handleEvent2);
        recognition.addEventListener('speechend', handleEvent2);
        recognition.addEventListener('soundend', handleEvent2);
        recognition.addEventListener('audioend', handleEvent2);
        recognition.addEventListener('result', handleEvent);
        recognition.addEventListener('nomatch', handleEvent);
        recognition.addEventListener('start', handleEvent2);
        recognition.addEventListener('end', handleEvent2);
        return () => {
            // @ts-ignore: refer to the top `wrong SpeechRecognition-related types` comments
            recognition.removeEventListener('error', onError);
            recognition.removeEventListener('audiostart', handleEvent2);
            recognition.removeEventListener('soundstart', handleEvent2);
            recognition.removeEventListener('speechstart', handleEvent2);
            recognition.removeEventListener('speechend', handleEvent2);
            recognition.removeEventListener('soundend', handleEvent2);
            recognition.removeEventListener('audioend', handleEvent2);
            recognition.removeEventListener('result', handleEvent);
            recognition.removeEventListener('nomatch', handleEvent);
            recognition.removeEventListener('start', handleEvent2);
            recognition.removeEventListener('end', handleEvent2);
        }
    }, [])

}