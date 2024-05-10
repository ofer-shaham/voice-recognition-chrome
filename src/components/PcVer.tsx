
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
import { Command } from "../types/speechRecognition";
import { isMobile } from '../services/isMobile';

import TranscriptHistory from './SpeechAndRecognitionComponents/TranscriptHistory';
import TranslationBox from './SpeechAndRecognitionComponents/TranslationBox';

import { translate } from '../utils/translate';
import { mapLanguageToCode } from '../utils/mapLanguageToCode';
import { INITIAL_DELAY_BETWEEN_WORDS, instructions } from '../consts/config';
import { useAvailableVoices } from '../hooks/useAvailableVoices';
import { populateAvailableVoices } from '../utils/getVoice';
import Instructions from './SpeechAndRecognitionComponents/Instructions';
import TranscriptOptions from './SpeechAndRecognitionComponents/TranscriptOptions';
import TranscriptLive from './SpeechAndRecognitionComponents/TranscriptLive';
import StartAndStopButtons from './SpeechAndRecognitionComponents/StartAndStopButtons';
import { freeSpeak } from '../utils/freeSpeak';
import Debug from './LogAndDebugComponents/Debug';
import { getLangCodeOnMobile } from '../utils/getLangCodeOnMobile';
import '../styles/pcVer.css'
import RangeInput from './SpeechAndRecognitionComponents/RangeInput';
import { FinalTranscriptHistory } from '../types/FinalTranscriptHistory';
import VoiceRecorder from './SpeechAndRecognitionComponents/VoiceRecorder';
import Logger from './LogAndDebugComponents/Logger';
import { useRecording } from '../hooks/useRecording';
import { useRecognitionEvents } from '../hooks/useRecognitionEvents';
import React from 'react';
import CheckBoxSwitch from './General/checkboxSwitch';
import useLanguageSelection from '../hooks/useLanguageSelection';


const PcVer: React.FC = () => {
    const [translation, setTranslation] = useState('')
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)

    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [isModeDebug, setIsModeDebug] = useState(false)
    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const [allowRecording, setAllowRecording] = useState(!isMobile);

    const [logMessages, setLogMessages] = useState<any[]>([]);
    const availableVoices = useAvailableVoices();

    const { startRecording, cancelRecording, stopRecording, isRecording } = useRecording(allowRecording)
    const listeningRef = useRef(false)
    const allowRecordingRef = useRef(allowRecording)
    const renderCountRef = useRef(0)

    const prevFinalTranscriptProxyRef = useRef('')
    const [selectedFromVoice, setSelectedFromVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [selectedToVoice, setSelectedToVoice] = useState<SpeechSynthesisVoice | null>(null);
    const {
        fromLang,
        setFromLang,
        toLang,
        setToLang,
    
    } = useLanguageSelection();
    renderCountRef.current += 1;

    const availableVoicesCode = useMemo<string[] | null>(() => availableVoices.map(r => r.lang), [availableVoices])
    useRecognitionEvents(SpeechRecognition)

    const abortListen = useCallback((): Promise<void> => {
        console.log('SpeechRecognition.getRecognition', SpeechRecognition.getRecognition())

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
        }
    ], [setFromLang, setToLang])

    const { finalTranscript,
        interimTranscript,
        transcript,
        listening,
        resetTranscript, isMicrophoneAvailable,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })

    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])



    /*
    update all refs according to state:
    */
    listeningRef.current = listening
    allowRecordingRef.current = allowRecording

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
        listeningRef.current && await abortListen()
        cancelRecording()
    }, [abortListen, cancelRecording])


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

    }, [finalTranscript, setFinalTranscriptProxy])

    //store finalTranscriptProxy prev value 
    useEffect(() => {
        if (finalTranscriptProxy) { prevFinalTranscriptProxyRef.current = finalTranscriptProxy }
    }, [finalTranscriptProxy])

    /*
    force recycle of current transcript 
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
            let audioEncodedString = ''

            try {
                audioEncodedString = await stopRecording()
            } catch (error) {
                // Handle the error here
                console.error('An error occurred while stopping recording:', error)
                // Additional error handling logic if needed
            }

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
            startListenAndRecord();
        }
    }, [isSpeaking, listening, startListenAndRecord,
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
                <p>render count: {renderCountRef.current}</p>
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
                handleStopListening={abortListen}
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

            <CheckBoxSwitch isModeValue={isModeDebug} setIsModeValue={setIsModeDebug} title='debug' />       
            <TranscriptLive finalTranscript={finalTranscript} interimTranscript={interimTranscript} transcript={transcript} isModeDebug={isModeDebug} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                    <TranslationBox setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang}
                        text={transcript || prevFinalTranscriptProxyRef.current} onfreeSpeakOnly={flaggedFreeSpeak} isActiveTalking={listening}
                        availableVoices={availableVoices} selectedVoice={selectedFromVoice} setSelectedVoice={setSelectedFromVoice}
                    />
                    <TranslationBox setText={setTranslation} setLanguage={setToLang} language={toLang}
                        text={translation || ''} onfreeSpeakOnly={onfreeSpeakOnly} isActiveTalking={isSpeaking}
                        availableVoices={availableVoices}
                        selectedVoice={selectedToVoice} setSelectedVoice={setSelectedToVoice}
                    />
                </div>
            </div>

            <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} onfreeSpeakOnly={onfreeSpeakOnly} onEndPlayback={startListenAndRecord} onBeforePlayback={stopListenAndRecord} />
            <RangeInput value={delayBetweenWords} setValue={setdelayBetweenWords} title='delayBetweenWords' />

            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>

            <Logger messages={logMessages} setMessages={setLogMessages} />
        </div>
    )
}
export default React.memo(PcVer)