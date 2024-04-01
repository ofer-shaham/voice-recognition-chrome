import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "./types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { availableVoices } from './services/AvailableVoices';
import languageMap from './consts/languageMap.json';
import { isMobile } from './services/isMobile';


/*
finalTranscript1 - is the source for a tts/translation operation. it replace the finalTranslcript functionality when the client is Mobile.
current solution: update its content based on changes to the transcription. when its not updated for 2 seconds - we force a content recycle.
*/
// let delta = 0
let deltaMax = 0

const LIMIT_ARR_CUT = 5
const LIMIT_ARR_CUT_FINAL = 2
const DELAY_LISTENING_RESTART = 1000
const MAX_DELAY_BETWEEN_RECOGNITIONS = 3000

const instructions = {
    "speak_english": 'say "speak english" - for making the application repeat what you say in english',
    "translate_from_to": "say 'translate from hebrew to russian' - for making the application recognize speech in hebrew and speak out the russian translation"
}

interface LanguageMap {
    [key: string]: string;
}
interface TranscriptHistory {
    finalTranscript1: string; uuid: number; fromLang: string; toLang: string;
}
interface FinalTranscriptHistory {
    finalTranscript1: string; uuid: number; translation: string; fromLang: string; toLang: string;
}

const cachedVoices: any = {}

export default function LanguageDashboard() {

    const [fromLang, setFromLang] = useState('iw-IL')
    const [toLang, setToLang] = useState('ar-AE')
    const [translation, setTranslation] = useState('')
    const [transcriptHistory, setTranscriptHistory1] = useState<TranscriptHistory[]>([])

    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscript1, setFinalTranscript1] = useState('');


    const [prevTranscript, setPrevTranscript] = useState('');
    const [prevTranscriptTime, setPrevTranscriptTime] = useState<[number, number]>([Date.now(), Date.now()]);

    const [isModeDebug, setIsModeDebug] = useState(true)
    const [maxDelayBetweenRecognitions, setMaxDelayBetweenRecognitions] = useState(MAX_DELAY_BETWEEN_RECOGNITIONS)


    const commands: Command[] = [
        {
            command: '(please) translate (from) * to *',
            callback: (fromLang: string, toLang: string) => {
                const fromCode = mapLanguageToCode(fromLang)
                const toCode = mapLanguageToCode(toLang)
                setFromLang(fromCode); setToLang(toCode)
                console.log(`from ${fromCode} to ${toCode}`)
            }
        },
        {
            command: 'speak *',
            callback: (language: string) => {
                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode)
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
        if (prevTranscriptTime[0] - prevTranscriptTime[1] > MAX_DELAY_BETWEEN_RECOGNITIONS * 1000) {
            resetTranscript()
            console.log('longer than ', MAX_DELAY_BETWEEN_RECOGNITIONS)
        }
    }, [prevTranscriptTime, resetTranscript])

    const getListeningOptions = useCallback((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const startListening = useCallback((): Promise<void> | never => {
        return SpeechRecognition.startListening(getListeningOptions()).catch(e => { throw new Error(e.message) });
    }, [getListeningOptions])


    useEffect(() => {
        if (!finalTranscriptHistory.length) return
        const speakIt = () => {
            const target = finalTranscriptHistory[finalTranscriptHistory.length - 1]
            setIsSpeaking(true)

            freeSpeech(target.translation || target.finalTranscript1, target.toLang).then(() => {
                setIsSpeaking(false)

            }).catch(e => {
                //one must click on the page in order to permit speech Synthesis 
                console.error(e);
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

        const completlyNewTranscript = !transcript.includes(prevTranscript)
        const alreadyStagedTranscript = finalTranscript1 === prevTranscript
        const keepSurvivorBeforeLost = completlyNewTranscript && !alreadyStagedTranscript


        //keep transcription that missed the final stage
        if (keepSurvivorBeforeLost) {
            // setTranscriptHistory1(prev => [...prev, { uuid: Date.now(), fromLang, toLang, finalTranscript1: prevTranscript }]);
            //on mobile we need to compansate for delayed resetTranscript scheduler
            if (isMobile) {
                setFinalTranscript1(prevTranscript);
            }
            console.log('lost', prevTranscript)
        }




        setPrevTranscriptTime(prev => [prev[1], Date.now()])
        setPrevTranscript(transcript)
    }, [
        //  'finalTranscript1', 'fromLang', 'prevTranscript', 'toLang', 'transcript'
        maxDelayBetweenRecognitions, setPrevTranscriptTime, resetTranscript,
        prevTranscript, transcript, setFinalTranscript1, setTranscriptHistory1, finalTranscript1, fromLang, toLang
    ])

    useEffect(() => {

    }, [prevTranscriptTime])

    useEffect(() => {
        if (!finalTranscript1) return;
        setIsSpeaking(true)
        let ignore = false;

        async function translate_and_speek() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscript1 !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscript1 : true)
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscript1, fromLang, toLang })
                    if (ignore) return
                    console.log('setTranslation', translationResult)

                    setTranslation(translationResult)
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: translationResult, fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        console.error(e)
                    })
                } else {
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: '', fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        console.error(e)
                    })
                }
            }
        }
        translate_and_speek()
        return () => { ignore = true }
    }, [finalTranscript1, fromLang, toLang, finalTranscriptHistory, setFinalTranscriptHistory])


    useEffect(() => {
        console.log('init app');

    }, [])

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null

        if (!isSpeaking) { timeoutId = setTimeout(startListening, isMobile ? DELAY_LISTENING_RESTART : DELAY_LISTENING_RESTART) }
        return () => { timeoutId && clearTimeout(timeoutId) }
    }, [isSpeaking, startListening]);




    useEffect(() => {
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscript1(finalTranscript);
    }, [finalTranscript, setFinalTranscript1])


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
        <div style={{ background: isSpeaking ? 'blue' : (listening ? 'green' : 'grey') }}>
            <p>deltaMax: {deltaMax}</p>
            <div id="instructions" style={{ background: 'grey' }} >
                <h1>How to use:</h1>
                <p onClick={() => { isModeDebug || freeSpeech(instructions.speak_english) }}>{instructions.speak_english}</p>
                <p onClick={() => { isModeDebug || freeSpeech(instructions.translate_from_to) }}>{instructions.translate_from_to}</p>
            </div>

            {!isModeDebug && (<>
                <div id="read_only_flags" style={{ background: 'brown' }}>
                    <p>is Microphone Available: {isMicrophoneAvailable ? 'yes' : 'no'}</p>
                    <p>listening: {listening ? 'yes' : 'no'}</p>
                    <p>speaking: {isSpeaking ? 'yes' : 'no'}</p>
                </div>
            </>)}
            <div id="buttons" style={{ background: 'darkblue' }}>
                <div>
                    <button disabled={!listening} onClick={() => SpeechRecognition.stopListening()}>Stop</button>
                    <button disabled={listening} onClick={() => SpeechRecognition.startListening(getListeningOptions())}>Start</button>
                </div>
                <div>
                    <button onClick={() => {
                        setFromLang('en-US')
                        setToLang('en-US')
                    }}>set language to english</button>
                    <button onClick={resetTranscript}>Reset Transcript</button>
                </div>
            </div>

            <div id="checkboxes" style={{ background: 'brown' }}>
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
                <label>
                    Debug modes:
                    <input
                        type="checkbox"
                        checked={isModeDebug}
                        onChange={() => setIsModeDebug(!isModeDebug)}
                    />
                </label>

            </div>



            <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                setSelectedVoice={setSelectedVoice} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {!isModeDebug && (<>
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

                            {/* finalTranscript1 history: */}
                            <input type="text" value={finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscript1 : ''} style={{ marginLeft: 'auto' }} readOnly />

                        </div>
                        <button onClick={() => { transcript || freeSpeech(finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscript1 : '', fromLang) }}>translate</button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'gray' }}>

                        <label style={{ marginRight: '10px' }}>to:</label>
                        <input onChange={(ev) => { setToLang(ev.target.value) }} type="text" value={toLang} style={{ marginLeft: 'auto' }} />

                        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>

                            <input type="text" value={translation} style={{ marginLeft: 'auto' }} readOnly />
                        </div>
                        <button onClick={() => { freeSpeech(translation, toLang) }}>translate</button>
                    </div>

                </div>
            </div>
            {!isModeDebug && (<>
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
                            <td>{r.finalTranscript1}</td>
                            <td>{r.translation}</td>
                        </tr>)}
                    </tbody>
                </table>
            </>)}


            {!isModeDebug && (<> <p>transcriptHistory</p>
                <table>
                    <thead>
                        <tr>
                            <th>id</th>
                            <th>fromLang</th>
                            <th>toLang</th>
                            <th>finalTranscript</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transcriptHistory.slice(-LIMIT_ARR_CUT).reverse().map((r, i) => <tr key={r.uuid}>
                            <td>{r.uuid}</td>
                            <td>{r.fromLang}</td>
                            <td>{r.toLang}</td>
                            <td>{r.finalTranscript1}</td>
                        </tr>)}
                    </tbody>
                </table></>)}

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
                <p>{Math.floor(prevTranscriptTime[1] / 1000) - (prevTranscriptTime[0] / 1000)}</p>
            </div>

            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>
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


const translate = ({ finalTranscript1, fromLang, toLang }: { finalTranscript1: string, fromLang: string, toLang: string }): Promise<string> => {
    return fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(finalTranscript1)}`)
        .then(res => res.json())
        .then(data => {
            const y = data[0][0][0]
            return y
        })
        .catch(err => {
            console.error(err.message); return `error, ${err.message}`
        })
}

