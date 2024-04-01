import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "./types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { availableVoices } from './services/AvailableVoices';
import languageMap from './consts/languageMap.json';
import { isMobile } from './services/isMobile';


/*
finalTranscript - is not function on mobile so we use finalTranscriptProxy as the source for translation/tts

build finalTranscriptProxy:
* on pc     - based on finalTranscript
* on mobile - recycle the transcript every X seconds.
 */


// const LIMIT_ARR_CUT = 5
const LIMIT_ARR_CUT_FINAL = 2
const DELAY_LISTENING_RESTART = 1000
const MAX_DELAY_BETWEEN_RECOGNITIONS = 3000

const instructions = {
    "speak_english": { test: 'speak english', explain: 'say "speak english" - for making the application repeat what you say in english' },
    "translate_from_en_to_ru": { test: 'translate from hebrew to russian', explain: "say 'translate from hebrew to russian' - for making the application recognize speech in hebrew and speak out the russian translation" },
    "translate_from_he_to_ar": { test: 'translate from hebrew to arabic', explain: "say 'translate from hebrew to arabic' - for making the application recognize speech in hebrew and speak out the russian translation" },

    "welcome": "hello world"

}

interface LanguageMap {
    [key: string]: string;
}

interface FinalTranscriptHistory {
    finalTranscriptProxy: string; uuid: number; translation: string; fromLang: string; toLang: string;
}

const cachedVoices: any = {}

export default function LanguageDashboard() {

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
    const [stream, setStream] = useState<MediaStream | null>(null);


    const handleMicAccess = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setStream(mediaStream);
            await freeSpeech(instructions.welcome)
        } catch (error) {
            console.error('Error getting user media:', error);
            alert('Error getting user media')
        }
    };

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
            command: 'speak *',
            callback: (language: string) => {
                debugger;
                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            }
        },
        {
            command: 'speak english',
            callback: () => {
                debugger;
                const langCode = mapLanguageToCode('english')
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            }
        },
    ]
    const { finalTranscript,
        interimTranscript,
        transcript,
        listening,
        resetTranscript, isMicrophoneAvailable,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })
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
        console.log('init app');

    }, [])

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        if (!isSpeaking && !listening) { timeoutId = setTimeout(listenNow, isMobile ? DELAY_LISTENING_RESTART : DELAY_LISTENING_RESTART) }
        return () => { timeoutId && clearTimeout(timeoutId) }
    }, [isSpeaking, startListening, listening]);




    useEffect(() => {
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscriptProxy(finalTranscript);
    }, [finalTranscript, setFinalTranscriptProxy])


    if (!browserSupportsSpeechRecognition) {
        alert('Your browser does not support speech recognition!')
        return null
    }


    const freeSpeech = (text: string, toLang: string = 'en-US'): Promise<void> => {
        console.log('freeSpeech', { text, toLang })
        return new Promise((resolve: any, reject: any) => {
            const utterance = new SpeechSynthesisUtterance(text);
            if (availableVoices) {
                const voice = getVoice(toLang, isMobile)
                if (!voice) {
                    console.warn('error - no voice found for language:', toLang)
                } else { utterance.voice = voice; }
                utterance.lang = toLang; //.replace('_', '-'); //TODO: may need to replace between _ ,-
            } else {
                console.error('no voices available')
            }
            utterance.addEventListener("error", (event: SpeechSynthesisErrorEvent) => {
                console.log(
                    `An error has occurred with the speech synthesis: ${event.error}`,
                    event);
            });
            try {
                utterance.onstart = function (ev) { setIsSpeaking(true) }
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
                    setIsSpeaking(false)
                    resolve()
                }
                speechSynthesis.speak(utterance);
            } catch (e) {
                console.error(e)
                reject(e)
            }
        })
    }

    return (
        <div>
            {stream ? (
                <div style={{ background: (isSpeaking ? 'blue' : (listening ? 'green' : 'grey')) }}>

                    <div id="instructions" style={{ background: 'grey' }} >
                        <h1>How to use:</h1>
                        <p onClick={() => { freeSpeech(instructions.speak_english.test) }}>{instructions.speak_english.explain}</p>
                        <p onClick={() => { freeSpeech(instructions.translate_from_en_to_ru.test) }}>{instructions.translate_from_en_to_ru.explain}</p>
                        <p onClick={() => { freeSpeech(instructions.translate_from_he_to_ar.test) }}>{instructions.translate_from_he_to_ar.explain}</p>
                    </div>


                    {isModeDebug && (<>
                        <div id="read_only_flags" style={{ background: 'brown' }}>
                            <p>is Microphone Available: {isMicrophoneAvailable ? 'yes' : 'no'}</p>
                            <p>listening: {listening ? 'yes' : 'no'}</p>
                            <p>speaking: {isSpeaking ? 'yes' : 'no'}</p>
                        </div>
                    </>)}
                    <div id="buttons" style={{ background: 'darkblue' }}>
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

                    <div id="checkboxes" style={{ background: 'brown' }}>
                        {isModeDebug && (<div>


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
                        </div>)}
                        <label>
                            Debug mode:
                            <input
                                type="checkbox"
                                checked={isModeDebug}
                                onChange={() => setIsModeDebug(!isModeDebug)}
                            />
                        </label>

                    </div>





                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                        {isModeDebug && (<>
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
                        </>)}


                        <div style={{ display: 'flex', flexDirection: 'row' }}>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'darkgray' }}>
                                <label style={{ marginRight: '10px' }}>from:</label>
                                <input onChange={(ev) => { setFromLang(ev.target.value) }} type="text" value={fromLang} style={{ marginLeft: 'auto' }} />
                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>

                                    {/* finalTranscriptProxy history: */}
                                    <input type="text" value={finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : ''} style={{ marginLeft: 'auto' }} readOnly />

                                </div>
                                <button onClick={() => { transcript || freeSpeech(finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : '', fromLang) }}>speak</button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'gray' }}>

                                <label style={{ marginRight: '10px' }}>to:</label>
                                <input onChange={(ev) => { setToLang(ev.target.value) }} type="text" value={toLang} style={{ marginLeft: 'auto' }} />

                                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>

                                    <input type="text" value={translation} readOnly />
                                </div>
                                <div>


                                    <button onClick={() => { freeSpeech(translation, toLang) }}>speak</button>
                                </div>

                            </div>

                        </div><VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                            setSelectedVoice={setSelectedVoice} />
                    </div>
                    {isModeDebug && (<>
                        <p>finalTranscriptHistory</p>
                        <table>
                            <thead>
                                <tr>
                                    <th>id</th>
                                    <th>fromLang</th>
                                    <th>toLang</th>
                                    <th>finalTranscript</th>
                                    <th>translation</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalTranscriptHistory.slice(-LIMIT_ARR_CUT_FINAL).reverse().map((r, i) => <tr key={r.uuid}>
                                    <td>{r.uuid}</td>
                                    <td>{r.fromLang}</td>
                                    <td>{r.toLang}</td>
                                    <td>{r.finalTranscriptProxy}</td>
                                    <td>{r.translation}</td>
                                </tr>)}
                            </tbody>
                        </table>
                    </>)}


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
            ) : (
                <button onClick={handleMicAccess}>Grant microphone access</button>
            )}
        </div>

    );
}



function getVoice(language: string, isMobile: boolean): SpeechSynthesisVoice {
    if (cachedVoices.hasOwnProperty(language)) {
        console.log('return voice', { cached_voice: cachedVoices[language] }); return cachedVoices[language]
    }
    const lowercasedLanguage = isMobile ? language.replace('-', '_') : language
    const filteredVoices = availableVoices.filter((r: SpeechSynthesisVoice) => r.lang === lowercasedLanguage)
    const length = filteredVoices.length
    const voice = filteredVoices[Math.floor(Math.random() * length)]
    //cache voice
    cachedVoices[language] = voice
    console.log('return voice', { voice })
    return voice
}


const mapLanguageToCode = (language: string): string => {
    const map: LanguageMap = languageMap;
    console.log({ language })
    if (!map) {
        console.error('Invalid languageMap');
        return 'en-US';
    }

    const normalizedLanguage = language.toLowerCase();
    for (const key in map) {
        if (key.toLowerCase().includes(normalizedLanguage)) {
            return map[key];
        }
    }

    return 'en-US';
};


const translate = ({ finalTranscriptProxy, fromLang, toLang }: { finalTranscriptProxy: string, fromLang: string, toLang: string }): Promise<string> => {
    return fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(finalTranscriptProxy)}`)
        .then(res => res.json())
        .then(data => {
            const y = data[0][0][0]
            return y
        })
        .catch(err => {
            console.error(err.message); return `error, ${err.message}`
        })
}
