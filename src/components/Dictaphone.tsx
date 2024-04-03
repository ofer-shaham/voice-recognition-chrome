import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "../types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { isMobile } from '../services/isMobile';

import Debug from '../Debug';
import TranscriptHistory from './TranscriptHistory';
import TranslationBox from './TranslationBox';

import { freeSpeech } from '../utils/freeSpeak'
import { translate } from '../utils/translate';
import { mapLanguageToCode } from '../utils/mapLanguageToCode';
import { DELAY_LISTENING_RESTART, MAX_DELAY_BETWEEN_RECOGNITIONS, instructions } from '../consts/config';
import { useAvailableVoices } from '../hooks/useAvailableVoices';
import { setAvailableVoices } from '../utils/getVoice';

/*
finalTranscript - is not function on mobile so we use finalTranscriptProxy as the source for translation/tts

build finalTranscriptProxy:
* on pc     - based on finalTranscript
* on mobile - recycle the transcript every X seconds.
 */





interface FinalTranscriptHistory {
    finalTranscriptProxy: string; uuid: number; translation: string; fromLang: string; toLang: string;
}


interface VoiceRecorderProps {
    stream: MediaStream | null;
}

export const Dictaphone: React.FC<VoiceRecorderProps> = ({ stream }) => {


    const [fromLang, setFromLang] = useState('en-US')
    const [toLang, setToLang] = useState('ru-RU')
    const [translation, setTranslation] = useState('')
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [prevTranscript, setPrevTranscript] = useState('');
    const [prevTranscriptTime, setPrevTranscriptTime] = useState<[number, number]>([Date.now(), Date.now()]);

    const [isModeDebug, setIsModeDebug] = useState(false)
    const [maxDelayBetweenRecognitions, setMaxDelayBetweenRecognitions] = useState(MAX_DELAY_BETWEEN_RECOGNITIONS)

    const availableVoices = useAvailableVoices();



    const commands: Command[] = [
        {
            command: '(please) translate (from) * to *',
            callback: (fromLang: string, toLang: string) => {
                const fromCode = mapLanguageToCode(fromLang)
                const toCode = mapLanguageToCode(toLang)
                setFromLang(fromCode); setToLang(toCode);
                console.log(`from ${fromCode} to ${toCode}`)
            }
        },

        {
            command: '(please) speak english',
            callback: () => {
                ;
                const langCode = mapLanguageToCode('english')
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            },
            matchInterim: true
        }, {
            command: '(please) speak :language',
            callback: (language: string) => {

                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            },
            matchInterim: true
        },
        {
            command: 'speak hebrew',
            callback: (command, spokenPhrase, similarityRatio) => console.info(`${command} and ${spokenPhrase} are ${similarityRatio * 100}% similar`),
            // If the spokenPhrase is "Benji", the message would be "Beijing and Benji are 40% similar"
            isFuzzyMatch: true,
            fuzzyMatchingThreshold: 0.2
        },
        {
            command: ['up', 'down', 'left', 'right'],
            callback: (command) => console.info(`Best matching command: ${command}`),
            isFuzzyMatch: true,
            fuzzyMatchingThreshold: 0.2,
            bestMatchOnly: true
        },
        {
            command: 'clear',
            callback: ({ resetTranscript }) => { console.info('got command: clear'); resetTranscript() }
        }
    ]

    const { finalTranscript,
        interimTranscript,
        transcript,
        listening,
        resetTranscript, isMicrophoneAvailable,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })

    useEffect(() => {
        if (!availableVoices.length) { console.warn('no voices') }
        else {
            setAvailableVoices(availableVoices)
            console.info({ availableVoices })
        }
    }, [availableVoices])

    useEffect(() => {
        if (isSpeaking && !speechSynthesis.speaking) {
            console.error('wierd status', speechSynthesis)
            // alert('force cancel speech')
            speechSynthesis.resume();
            speechSynthesis.cancel();
        }

    }, [isSpeaking])
    useEffect(() => {
        if (prevTranscriptTime[0] - prevTranscriptTime[1] > MAX_DELAY_BETWEEN_RECOGNITIONS * 1000) {
            resetTranscript()
            console.log('longer than ', MAX_DELAY_BETWEEN_RECOGNITIONS)
        }
    }, [prevTranscriptTime, resetTranscript])

    const getListeningOptions = useCallback((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const listenNow = useCallback((): Promise<void> => {
        try {

            return SpeechRecognition.startListening(getListeningOptions())
        } catch (e) {
            console.error(e);
            return Promise.reject(e)
        }
    }, [getListeningOptions])

    useEffect(() => {
        try {
            listenNow();
        } catch (e) {
            console.error(e)
        }

    }, [listenNow])

    const startListening = useCallback((): Promise<void> | never => {
        return SpeechRecognition.startListening(getListeningOptions()).catch(e => { throw new Error(e.message) });
    }, [getListeningOptions])



    useEffect(() => {
        if (!finalTranscriptHistory.length) return
        const speakIt = () => {
            const target = finalTranscriptHistory[finalTranscriptHistory.length - 1]
            setIsSpeaking(true)

            freeSpeech(target.translation || target.finalTranscriptProxy, target.toLang).then(() => {
                setIsSpeaking(false)

            }).catch(e => {
                console.error(e);
                if (e === "not-allowed") alert('please tap on the page to permit access to microphone')


                //one must click on the page in order to permit speech Synthesis 

                setIsSpeaking(false)
            });
        }
        speakIt()
    }, [finalTranscriptHistory])



    /**
     * keep transcript that haven't reach the final stage
     * on mobile - advance it to final stage
     */
    useEffect(() => {
        if (!isMobile) return
        const completlyNewTranscript = !transcript.includes(prevTranscript)
        const alreadyStagedTranscript = finalTranscriptProxy === prevTranscript
        const keepSurvivorBeforeLost = completlyNewTranscript && !alreadyStagedTranscript

        //keep transcription that missed the final stage
        if (keepSurvivorBeforeLost) {
            //on mobile we need to compansate for delayed resetTranscript scheduler
            console.log('saving it:' + prevTranscript)
            setFinalTranscriptProxy(prevTranscript);
        }
        setPrevTranscriptTime(prev => [prev[1], Date.now()])
        setPrevTranscript(transcript)
    }, [
        finalTranscriptProxy, prevTranscript, transcript
    ])

    useEffect(() => {
        if (!isMobile) return

        if (prevTranscriptTime[0] - prevTranscriptTime[1] > maxDelayBetweenRecognitions)
            console.log('resetTranscript')
        resetTranscript()
    }, [prevTranscriptTime, maxDelayBetweenRecognitions, resetTranscript])

    useEffect(() => {
        if (!finalTranscriptProxy) return;
        setIsSpeaking(true)
        let ignore = false;

        async function translate_and_speek() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscriptProxy !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : true)
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscriptProxy, fromLang, toLang })
                    if (ignore) return
                    console.log('setTranslation', translationResult)

                    setTranslation(translationResult)
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: translationResult, fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        console.error(e)
                    })
                } else {
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: '', fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        console.error(e)
                    })
                }
            }
        }
        translate_and_speek()
        return () => { ignore = true }
    }, [finalTranscriptProxy, fromLang, toLang, finalTranscriptHistory, setFinalTranscriptHistory])




    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null


        if (!isSpeaking && !listening) {

            timeoutId = setTimeout(listenNow, isMobile ? DELAY_LISTENING_RESTART : 0)
        }
        return () => { timeoutId && clearTimeout(timeoutId) }
    }, [isSpeaking, startListening, listening, listenNow]);




    useEffect(() => {
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscriptProxy(finalTranscript);
    }, [finalTranscript, setFinalTranscriptProxy])


    if (!browserSupportsSpeechRecognition) {
        alert('Your browser does not support speech recognition!')
        return null
    }




    return (

        <div style={{ background: (isSpeaking ? 'blue' : (listening ? 'green' : 'grey')) }}>

            <div id="instructions" style={{ background: 'grey' }} >
                <h1>How to use:</h1>
                <button onClick={() => { freeSpeech(instructions.speak_english.test) }}>{instructions.speak_english.explain}</button>
                <button onClick={() => { freeSpeech(instructions.translate_from_en_to_ru.test) }}>{instructions.translate_from_en_to_ru.explain}</button>
                <button onClick={() => { freeSpeech(instructions.translate_from_he_to_ar.test) }}>{instructions.translate_from_he_to_ar.explain}</button>
            </div>


            <Debug isModeDebug={isModeDebug}>
                <div id="read_only_flags" >
                    <p>is Microphone Available: {isMicrophoneAvailable ? 'yes' : 'no'}</p>
                    <p>listening: {listening ? 'yes' : 'no'}</p>
                    <p>speaking: {isSpeaking ? 'yes' : 'no'}</p>
                </div>
            </Debug>
            <div id="buttons" style={{ background: 'grey' }}>
                <div>
                    <button disabled={!listening} onClick={() => SpeechRecognition.stopListening()}>Stop</button>
                    <button style={{ color: 'darkgreen' }} disabled={listening} onClick={() => listenNow()}>Start</button>
                </div>
                <div>
                    <button onClick={() => {
                        setFromLang('en-US')
                        setToLang('en-US');
                        setTranslation('')
                    }}>reset languages</button>
                    <button onClick={resetTranscript}>Reset Transcript</button>
                </div>
            </div>


            <Debug isModeDebug={isModeDebug}>
                <div>


                    <label>
                        Interim Results:
                        <input
                            type="checkbox"
                            checked={isInterimResults}
                            onChange={() => setIsInterimResults(!isInterimResults)}
                        />
                    </label>
                    <br />
                    <label>
                        Continuous:
                        <input
                            type="checkbox"
                            checked={isContinuous}
                            onChange={() => setIsContinuous(!isContinuous)}
                        />
                    </label>
                    <br />
                </div>
            </Debug>


            <div id="configuration" >
                <label>
                    Debug mode:
                    <input
                        type="checkbox"
                        checked={isModeDebug}
                        onChange={() => setIsModeDebug(!isModeDebug)}
                    />
                </label>
            </div>







            <Debug isModeDebug={isModeDebug}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript:</label>
                    <input type="text" value={finalTranscript} style={{ marginLeft: 'auto' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>transcript:</label>
                    <input type="text" value={transcript} style={{ marginLeft: 'auto' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>interimTranscript:</label>
                    <input type="text" value={interimTranscript} style={{ marginLeft: 'auto' }} readOnly />
                </div>
            </Debug>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>


                <div style={{ display: 'flex', flexDirection: 'row' }}>

                </div><VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                    setSelectedVoice={setSelectedVoice} />
            </div>
            <TranslationBox setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang} text={finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : ''} onFreeSpeech={freeSpeech} />

            <TranslationBox   setText={setTranslation} setLanguage={setToLang} language={toLang}
                text={translation || ''}
                onFreeSpeech={freeSpeech} />

            <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} isModeDebug={isModeDebug} />

            {isMobile && (<>
                <div>
                    <label htmlFor="rangeInput">maxDelayBetweenRecognitions:</label>
                    <input
                        type="range"
                        id="rangeInput"
                        name="maxDelayBetweenRecognitions"
                        min="0"
                        max={MAX_DELAY_BETWEEN_RECOGNITIONS * 2}
                        step="0.1"
                        value={maxDelayBetweenRecognitions}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            const value = parseFloat(event.target.value);
                            setMaxDelayBetweenRecognitions(value);
                        }}
                    />
                    <br />
                    <p>{maxDelayBetweenRecognitions}</p>
                    <p>{Math.floor((prevTranscriptTime[1] - prevTranscriptTime[0]) / 1000)}</p>
                </div>
            </>)}
            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>
        </div>
    )


}




