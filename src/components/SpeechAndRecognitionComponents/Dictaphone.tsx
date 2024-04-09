
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
import { SpeakLog } from '../LogAndDebugComponents/SpeakLog';
import { freeSpeak } from '../../utils/freeSpeak';
import Debug from '../LogAndDebugComponents/Debug';
import { getLangCodeOnMobile } from '../../utils/getLangCodeOnMobile';
import '../../styles/Dictaphone.css'
import RangeInput from './RangeInput';
// import RecordingComponent from './VoiceRecorder';
import { MediaRecorderRecordingService } from '../../services/RecordService';
import { FinalTranscriptHistory } from '../../types/FinalTranscriptHistory';



export const Dictaphone: React.FC = () => {
    const [fromLang, setFromLang] = useState('he-IL')
    const [toLang, setToLang] = useState('ar-AE')
    const [translation, setTranslation] = useState('')
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [isModeDebug, setIsModeDebug] = useState(false)
    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const availableVoices = useAvailableVoices();


    const listeningRef = useRef(false)
    const availableVoicesCode = useMemo<string[] | null>(() => availableVoices.map(r => r.lang), [availableVoices])
    // const [recordingService, setRecordingService] = useState<RecordingService | null>(null);
    const [isRecording, setIsRecording] = useState(true);

    const newRecordingService = useRef<MediaRecorderRecordingService | null>(null)

    const stopListen = useCallback((): Promise<void> => {
        return SpeechRecognition.abortListening().catch(e => console.error('abortListening', e));
    }, [])

    // const stopListen = async () => {
    //     if (listeningRef.current) {
    //         return SpeechRecognition.abortListening().catch(e => console.error('abortListening', e));
    //     }
    // }

    const handleStartRecording = useCallback(() => {

        newRecordingService.current = new MediaRecorderRecordingService(new AudioContext());
        newRecordingService.current.startRecording();


    }, [])

    const handleStopRecording = useCallback(async () => {
        const encodedAudioString = await newRecordingService.current?.stopRecording();
        if (encodedAudioString) return encodedAudioString
        return ''
    }, []);



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
            if (isRecording) {
                handleStartRecording()
            } return SpeechRecognition.startListening(listeningOptions)
        } catch (e) {
            console.error(e);
            return Promise.reject(e)
        }
    }, [listeningOptions, isRecording, handleStartRecording])

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
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscriptProxy(finalTranscript);
        console.log('setFinalTranscriptProxy', { finalTranscript })
    }, [finalTranscript, setFinalTranscriptProxy])

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
            await stopListen()
            await freeSpeak(targetText as string, targetLang as string).catch(e => console.error('freeSpeak', e));
            await startListen().catch(e => console.error('startListen', e));
            console.log()
        };
        speakIt();
    }, [finalTranscriptHistory, availableVoicesCode, startListen, stopListen]);

    /*
    force recycle of current transcript on mobile
    */
    useEffect(() => {
        if (!isMobile) return;
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

            let audioEncodedString = ''
            if (isRecording) { audioEncodedString = await handleStopRecording().catch(e => { console.error(e); return e.message }) }
            console.info({ isRecording, audioEncodedString: audioEncodedString?.length })
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
    }, [finalTranscriptProxy, fromLang, toLang, finalTranscriptHistory, setFinalTranscriptHistory, handleStopRecording, isRecording])

    /**
     * listening will be forced by the speaking effect
     */
    useEffect(() => {
        if (!isSpeaking && !listening) {
            startListen();
        }
    }, [isSpeaking, listening, startListen,
    ]);

    if (!browserSupportsSpeechRecognition) {
        alert('Your browser does not support speech recognition!')
        return null
    }

    const onEndedCB = () => {
        startListen()
    }
    const onBeforePlayCB = async () => {
        listening && await stopListen()
        isRecording && newRecordingService?.current?.cancelRecording();
    }
    const onfreeSpeak = async (text: string, lang: string) => {
        await onBeforePlayCB()
        await freeSpeak(text, lang)
        onEndedCB()
    }


    return (
        <div className='Dictaphone' style={{ background: (isSpeaking ? 'blue' : (listening ? 'green' : 'grey')) }}>
            <Instructions instructions={instructions} />
            {/* <RecordingComponent /> */}
            {/* <label>
                run non-stop:
                <input
                    type="checkbox"
                    checked={isNonStop}
                    onChange={() => setIsNonStop(prev => !prev)}
                />
            </label> */}
            {/* <SpeakLog setIsSpeaking={setIsSpeaking} isSpeaking={isSpeaking} /> */}
            {/* <p>Is Speaking: {isSpeaking ? 'Yes' : 'No'}</p> */}
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
                setIsRecording={setIsRecording}
                isRecording={isRecording}
            />
            <TranscriptOptions
                isModeDebug={true}
                isInterimResults={isInterimResults}
                setIsInterimResults={setIsInterimResults}
                isContinuous={isContinuous}
                setIsContinuous={setIsContinuous}
            />

            <DebugModeSwitch isModeDebug={isModeDebug} setIsModeDebug={setIsModeDebug} />
            <TranscriptLive finalTranscript={finalTranscript} interimTranscript={interimTranscript} transcript={transcript} isModeDebug={isModeDebug} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                    <TranslationBox setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang}
                        text={transcript || (finalTranscriptHistory.length ?
                            finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : '')} onfreeSpeak={freeSpeak}></TranslationBox>
                    <TranslationBox setText={setTranslation} setLanguage={setToLang} language={toLang}
                        text={translation || ''}
                        onfreeSpeak={freeSpeak} >
                        <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                            setSelectedVoice={setSelectedVoice} />
                    </TranslationBox>


                </div>
            </div>
            <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} onfreeSpeak={onfreeSpeak} onEndedCB={onEndedCB} onBeforePlayCB={onBeforePlayCB} />
            {isMobile && (
                <RangeInput delayBetweenWords={delayBetweenWords} setdelayBetweenWords={setdelayBetweenWords} />
            )}
            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>
        </div>
    )
}
