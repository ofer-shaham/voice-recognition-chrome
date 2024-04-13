
/*
finalTranscript - is not function on mobile so we use finalTranscriptProxy as the source for translation/tts

build finalTranscriptProxy:
* on pc     - based on finalTranscript
* on mobile - recycle the transcript every X seconds.
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import SpeechRecognition, {
    ListeningOptions, useSpeechRecognition, // SpeechRecognitionOptions 
} from 'react-speech-recognition'
import { Command } from "../../types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { isMobile } from '../../services/isMobile';

import TranscriptHistory from './TranscriptHistory';
import TranslationBox from './TranslationBox';

import { translate } from '../../utils/translate';
import { mapLanguageToCode } from '../../utils/mapLanguageToCode';
import { INITIAL_DELAY_BETWEEN_WORDS, instructions } from '../../consts/config';
import { useAvailableVoices } from '../../hooks/useAvailableVoices';
import { populateAvailableVoices } from '../../utils/getVoice';
import Instructions from './Instructions';
import TranscriptOptions from './TranscriptOptions';
import TranscriptLive from './TranscriptLive';
import StartAndStopButtons from './StartAndStopButtons';
import DebugModeSwitch from '../LogAndDebugComponents/DebugModeSwitch';
import { freeSpeak } from '../../utils/freeSpeak';
import Debug from '../LogAndDebugComponents/Debug';
import { getLangCodeOnMobile } from '../../utils/getLangCodeOnMobile';
import '../../styles/Dictaphone.css'
import RangeInput from './RangeInput';
import { FinalTranscriptHistory } from '../../types/FinalTranscriptHistory';
import { VoiceRecorder } from './VoiceRecorder';
import { Logger } from '../LogAndDebugComponents/Logger';
import { useRecording } from '../../hooks/useRecording';


export const Dictaphone: React.FC = () => {
    const [fromLang, setFromLang] = useState('he-IL')
    const [toLang, setToLang] = useState(isMobile ? 'ar-AE' : 'ru-RU')
    const [translation, setTranslation] = useState('')
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    // const isSpeaking = useSpeechSynthesis()
    const [isSpeaking, setIsSpeaking] = useState(false)

    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [isModeDebug, setIsModeDebug] = useState(false)
    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const [allowRecording, setAllowRecording] = useState(true);

    const [logMessages, setLogMessages] = useState<any[]>([]);
    const availableVoices = useAvailableVoices();

    const { startRecording, cancelRecording, stopRecording, isRecording } = useRecording(allowRecording)
    const listeningRef = useRef(false)
    const allowRecordingRef = useRef(true)
    const prevFinalTranscriptProxy = useRef('')

    allowRecordingRef.current = allowRecording


    const availableVoicesCode = useMemo<string[] | null>(() => availableVoices.map(r => r.lang), [availableVoices])


    const stopListen = useCallback((): Promise<void> => {
        return SpeechRecognition.stopListening().catch(e => console.error('stopListening', e));
    }, [])


    const commands = useMemo<Command[]>(() => [
        {
            command: '(‏) (please) translate (from) * to *',
            callback: (fromLang: string, toLang: string) => {
                const fromCode = mapLanguageToCode(fromLang)
                const toCode = mapLanguageToCode(toLang)
                setFromLang(fromCode); setToLang(toCode);
                console.log(`from ${fromCode} to ${toCode}`)
            }
        },
        // {
        //     command: '(‏) (please) speak english',
        //     callback: () => {
        //         ;
        //         const langCode = mapLanguageToCode('english')
        //         setFromLang(langCode);
        //         setToLang(langCode);
        //         setTranslation('')
        //     },
        //     matchInterim: true
        // },
        {
            command: '(‏) (please) speak :language',
            callback: (language: string) => {

                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
                console.log('match :languge')
            },
            matchInterim: true
        },
        // {
        //     command: '(‏)speak english',
        //     callback: () => {
        //         const langCode = mapLanguageToCode('english')
        //         setFromLang(langCode);
        //         setToLang(langCode);
        //         setTranslation('')
        //         console.log('matchInterim')
        //     },
        //     matchInterim: true
        // },
        // {
        //     command: ['up', 'down', 'left', 'right'],
        //     callback: (command) => console.info(`Best matching command: ${command}`),
        //     isFuzzyMatch: true,
        //     fuzzyMatchingThreshold: 0.8,
        //     bestMatchOnly: true
        // },
        // {
        //     command: ['שמאל', 'ימין', 'למעלה', 'למטה'],
        //     callback: (command) => console.info(`Best matching command: ${command}`),
        //     matchInterim: true
        // }
    ], [])

    const { finalTranscript,
        interimTranscript,
        transcript,
        listening,
        resetTranscript, isMicrophoneAvailable,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })
    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])
    //workaround to avoid a change of listening state to trigger a speak useEffect 
    listeningRef.current = listening

    const startListen = useCallback((): Promise<void> => {
        try {
            return SpeechRecognition.startListening(listeningOptions)
        } catch (e) {
            console.error(e);
            return Promise.reject(e)
        }
    }, [listeningOptions])



    const startListenAndRecord = useCallback(() => {
        startListen();
        allowRecordingRef.current && startRecording()
    }, [startRecording, startListen])



    const stopListenAndRecord = useCallback(async () => {
        listeningRef.current && await stopListen()
        cancelRecording()
    }, [stopListen, cancelRecording])


    const flaggedFreeSpeak = useCallback(async (text: string, lang: string) => {
        setIsSpeaking(() => true)
        await freeSpeak(text, lang).catch(e => console.error(e.message))
        setIsSpeaking(() => false)
    }, [])


    const onfreeSpeakOnly = useCallback(async (text: string, lang: string) => {
        await stopListenAndRecord()
        await flaggedFreeSpeak(text, lang)
        startListenAndRecord()
    }, [startListenAndRecord, stopListenAndRecord, flaggedFreeSpeak])






    /*
    * update devices' available voices
    */
    useEffect(() => {
        if (!availableVoices.length) { console.warn('no voices') }
        else {
            populateAvailableVoices(availableVoices)
            console.info('some voices', { availableVoices })
        }
    }, [availableVoices])

    useEffect(() => {

        setFinalTranscriptProxy(() => finalTranscript);
        console.log('setFinalTranscriptProxy', { finalTranscript })
        return () => {
            prevFinalTranscriptProxy.current = finalTranscript
        }
    }, [finalTranscript, setFinalTranscriptProxy])



    /*
    force recycle of current transcript on mobile
    */
    useEffect(() => {
        const delay = delayBetweenWords; // Delay in milliseconds
        let timerId: NodeJS.Timeout | null = null;

        if (transcript) {
            timerId = setTimeout(() => {
                setFinalTranscriptProxy(transcript)
                resetTranscript();
            }, delay);
        }

        return () => {
            timerId && clearTimeout(timerId);
        };
    }, [transcript, resetTranscript, delayBetweenWords]);

    /*
     update history. 
     */
    useEffect(() => {
        if (!finalTranscriptProxy) { return; };
        console.log('translate', { finalTranscriptProxy })


        async function appendToHistory() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscriptProxy !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : true)

            const audioEncodedString = await stopRecording()
            // console.info({ audioEncodedString: audioEncodedString?.length })
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscriptProxy, fromLang, toLang })
                    console.log('setTranslation', translationResult)
                    setTranslation(translationResult)
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: translationResult, fromLang: fromLang, toLang: toLang, audioData: audioEncodedString }])
                } else {
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: '', fromLang: fromLang, toLang: toLang, audioData: audioEncodedString }])
                }
                console.info({ finalTranscriptHistory })
            }
        }

        appendToHistory()
        return () => {
            console.log('doTranslate')
        }
    },
        [finalTranscriptProxy, fromLang, toLang, finalTranscriptHistory, stopRecording])

    /**
     * listening will be forced by the speaking effect
     */
    useEffect(() => {
        if (!isSpeaking && !listening) {
            startListen();
        }
    }, [isSpeaking, listening, startListen,
    ]);




    /**
        * speak the last peece of history
        * change state: isSpeaking
        * 
        */
    useEffect(() => {
        if (!finalTranscriptHistory.length) {
            console.log('finalTranscriptHistory is empty')

            return
        };
        const target = finalTranscriptHistory[finalTranscriptHistory.length - 1];

        let targetText: string | null = null
        let targetLang: string | null = null
        //set target text and language
        if (target.translation) {
            targetText = target.translation
            targetLang = target.toLang
        } else {
            targetText = target.finalTranscriptProxy
            targetLang = target.fromLang
        }

        if (!targetText || !targetLang) return
        if (!availableVoicesCode?.includes(getLangCodeOnMobile(targetLang, isMobile))) {
            console.warn('there is no voice for lang:' + targetLang)
        }

        const speakIt = async () => {
            await onfreeSpeakOnly(targetText as string, targetLang as string).catch(e => console.error('freeSpeak', e));
        };
        speakIt();

    }, [finalTranscriptHistory, availableVoicesCode, onfreeSpeakOnly]);



    ////////////////////condition
    if (!browserSupportsSpeechRecognition) {
        alert('Your browser does not support speech recognition!')
        return null
    }

    return (
        <div className='Dictaphone' style={{ background: (isSpeaking ? 'blue' : (listening ? 'green' : 'grey')) }}>
            <Debug isModeDebug={isModeDebug}>
                <VoiceRecorder />
            </Debug>
            <Instructions instructions={instructions} />

            <p>Is Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
            <Debug isModeDebug={isModeDebug}>
                <div id="read_only_flags" >
                    <p>is Microphone Available: {isMicrophoneAvailable ? 'yes' : 'no'}</p>
                    <p>listening: {listening ? 'yes' : 'no'}</p>
                    <p>speaking: {isSpeaking ? 'yes' : 'no'}</p>
                    <p>recording: {isRecording ? 'yes' : 'no'}</p>
                </div>
            </Debug>


            <StartAndStopButtons
                listening={listening}
                startListen={startListen}
                resetTranscript={resetTranscript}
                setFromLang={setFromLang}
                setToLang={setToLang}
                setTranslation={setTranslation}
                handleStopListening={stopListen}
                setIsRecording={setAllowRecording}
                isRecording={isRecording}
            />
            <TranscriptOptions
                isModeDebug={true}
                isInterimResults={isInterimResults}
                setIsInterimResults={setIsInterimResults}
                isContinuous={isContinuous}
                setIsContinuous={setIsContinuous}
                allowRecording={allowRecording}
                setAllowRecording={setAllowRecording}
            />

            <DebugModeSwitch isModeDebug={isModeDebug} setIsModeDebug={setIsModeDebug} />
            <TranscriptLive finalTranscript={finalTranscript} interimTranscript={interimTranscript} transcript={transcript} isModeDebug={isModeDebug} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                    <TranslationBox setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang}
                        text={transcript || (finalTranscriptHistory.length ?
                            finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : '')} onfreeSpeakOnly={flaggedFreeSpeak}></TranslationBox>
                    <TranslationBox setText={setTranslation} setLanguage={setToLang} language={toLang}
                        text={translation || ''}
                        onfreeSpeakOnly={onfreeSpeakOnly} >
                        <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                            setSelectedVoice={setSelectedVoice} />
                    </TranslationBox>



                </div>
            </div>

            <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} onfreeSpeakOnly={onfreeSpeakOnly} onEndPlayback={startListenAndRecord} onBeforePlayback={stopListenAndRecord} />
            <RangeInput delayBetweenWords={delayBetweenWords} setdelayBetweenWords={setdelayBetweenWords} />

            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>

            <Logger messages={logMessages} setMessages={setLogMessages} />
        </div>
    )
}
