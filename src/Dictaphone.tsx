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

const LIMIT_ARR_CUT = 5
const LIMIT_ARR_CUT_FINAL = 2
const DELAY_LISTENING_RESTART = 1000

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

    const [fromLang, setFromLang] = useState('en-US')
    const [toLang, setToLang] = useState('en-US')
    const [translation, setTranslation] = useState('')
    const [transcriptHistory, setTranscriptHistory1] = useState<TranscriptHistory[]>([])

    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscript1, setFinalTranscript1] = useState('');
    const [prevTranscript, setPrevTranscript] = useState('');
    const [danger, setDanger] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const commands: Command[] = [
        {
            command: 'translate (from) * to *',
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
        resetTranscript,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })
    const onVacation = !listening && !isSpeaking && !isLoading



    const getListeningOptions = useCallback((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null;

        const resetDanger = () => {
            setDanger(true);
            timeoutId = setTimeout(() => {
                setDanger(false);
            }, 2000);
        };

        if (onVacation) {
            resetDanger();
        } else {
            setDanger(false);
            timeoutId && clearTimeout(timeoutId);
        }

        return () => {
            timeoutId && clearTimeout(timeoutId);
        };
    }, [onVacation]);


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
            setTranscriptHistory1(prev => [...prev, { uuid: Date.now(), fromLang, toLang, finalTranscript1: prevTranscript }]);
            //on mobile we need to compansate for depected update to finalTranscript
            if (isMobile) {
                setFinalTranscript1(prevTranscript);
            }
        }
        setPrevTranscript(transcript)
    }, [prevTranscript, transcript, setFinalTranscript1, setTranscriptHistory1, finalTranscript1, fromLang, toLang])

    useEffect(() => {
        if (!finalTranscript1) return
        setIsLoading(true)
        //let ignore = false;
        const freeSpeech =
            (text: string) => {
                const utterance = new SpeechSynthesisUtterance(text);
                if (availableVoices) {
                    const voice = getVoice(toLang, isMobile)
                    if (!voice) {
                        console.warn('error - no voice found for language:', toLang)
                    }
                    utterance.voice = voice || null
                    utterance.lang = toLang.replace('_', '-'); //TODO: may need to replace between _ ,-
                } else {
                    console.error('no voices available')
                }
                utterance.addEventListener("error", (event: SpeechSynthesisErrorEvent) => {
                    console.log(
                        `An error has occurred with the speech synthesis: ${event.error}`,
                    );
                    alert(event.error)
                });
                try {
                    utterance.onstart = function (ev) { setIsSpeaking(true) }
                    utterance.onerror = function (event) {
                        console.log(
                            `An error has occurred with the speech synthesis: ${event.error}`,
                        );
                        alert(event.error)
                    }
                    utterance.onboundary = function (ev) { console.info('onboundary', { ev }) }
                    utterance.onmark = function (ev) { console.info('onmark', { ev }) }
                    utterance.onpause = function (ev) { console.info('onpause', { ev }) }
                    utterance.onresume = function (ev) { console.info('onresume', { ev }) }
                    utterance.onend = function (ev) {
                        console.log('finished speaking and start listening again')
                        setIsSpeaking(false)
                        setIsLoading(false)

                    }
                    speechSynthesis.speak(utterance)

                } catch (e) {
                    console.error(e)
                }
            }
        async function translate_and_speek() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscript1 !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscript1 : true)
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscript1, fromLang, toLang })
                    //if (ignore) return
                    console.log('setTranslation', translationResult)

                    setTranslation(translationResult)
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: translationResult, fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        throw new Error(e.message)
                    })
                    freeSpeech(translationResult);
                } else {
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: '', fromLang: fromLang, toLang: toLang }])
                    await SpeechRecognition.abortListening().catch(e => {
                        throw new Error(e.message)
                    })
                    freeSpeech(finalTranscript1)
                }
            }
        }
        translate_and_speek()

    }, [finalTranscript1, fromLang, toLang, finalTranscriptHistory, setFinalTranscriptHistory])


    useEffect(() => {

        let timeoutId: NodeJS.Timeout | null = null
        async function startListening() {
            try {
                resetTranscript()
                await SpeechRecognition.startListening(getListeningOptions());
                console.log('Started listening');
            } catch (error) {
                console.error(error);
            }
        }

        if (onVacation) { timeoutId = setTimeout(startListening, isMobile ? DELAY_LISTENING_RESTART : 0) }

        return () => { timeoutId && clearTimeout(timeoutId) }

    }, [getListeningOptions, resetTranscript, onVacation]);




    useEffect(() => {
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscript1(finalTranscript);
    }, [finalTranscript, setFinalTranscript1])


    if (!browserSupportsSpeechRecognition) {
        console.error('Your browser does not support speech recognition!')
        return null
    }

    return (
        <div style={{ background: danger ? 'grey' : 'green' }}>
            <div>
                <h1>How to use:</h1>
                <p>"speak english" - to reset source and destination language</p>
                <p>"translate from hebrew to russian" -   recognized hebrew and speak out the russian translation</p>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>
            <p>Microphone: {listening ? 'on' : 'off'}</p>
            <p>currently proccess: {isLoading ? 'yes' : 'no'}</p>

            <button onClick={SpeechRecognition.stopListening}>Stop</button>
            <button disabled={listening} onClick={() => SpeechRecognition.startListening(getListeningOptions())}>Start</button>
            <div>
                <label>
                    Interim Results:{isInterimResults ? 'yes' : 'no'}
                    <input
                        type="checkbox"
                        checked={isInterimResults}
                        onChange={() => setIsInterimResults(!isInterimResults)}
                    />
                </label>
                <br />
                <label>
                    Continuous:{isContinuous ? 'yes' : 'no'}
                    <input
                        type="checkbox"
                        checked={isContinuous}
                        onChange={() => setIsContinuous(!isContinuous)}
                    />
                </label>                <br />

            </div>


            <button onClick={resetTranscript}>Reset Transcript</button>

            <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                setSelectedVoice={setSelectedVoice} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript1 history:</label>
                    <input type="text" value={finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscript1 : ''} style={{ marginLeft: 'auto' }} readOnly />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript:</label>
                    <input type="text" value={finalTranscript} style={{ marginLeft: 'auto' }} readOnly />
                </div>
                {/* <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript1:</label>
                    <input type="text" value={finalTranscript1} style={{ marginLeft: 'auto' }} readOnly />
                </div> */}
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>transcript:</label>
                    <input type="text" value={transcript} style={{ marginLeft: 'auto' }} readOnly />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>interimTranscript:</label>
                    <input type="text" value={interimTranscript} style={{ marginLeft: 'auto' }} readOnly />
                </div>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>translation:</label>
                    <input type="text" value={translation} style={{ marginLeft: 'auto' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row' }}>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ marginRight: '10px' }}>fromLang:</label>
                        <input type="text" value={fromLang} style={{ marginLeft: 'auto' }} readOnly />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <label style={{ marginRight: '10px' }}>toLang:</label>
                        <input type="text" value={toLang} style={{ marginLeft: 'auto' }} readOnly />
                    </div>
                </div>
            </div>
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
            <p>transcriptHistory</p>
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
            </table>
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
