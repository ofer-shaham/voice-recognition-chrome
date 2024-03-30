import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "./types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { availableVoices } from './services/AvailableVoices';
import languageMap from './consts/languageMap.json';
import { isMobile } from './services/isMobile';

interface LanguageMap {
    [key: string]: string;
}

const fromLangInit = 'English'
const toLangInit = 'English'

const cachedVoices: any = {}

export default function LanguageDashboard() {

    const [fromLang, setFromLang] = useState(mapLanguageToCode(fromLangInit))
    const [toLang, setToLang] = useState(mapLanguageToCode(toLangInit))
    const [translation, setTranslation] = useState('')
    const [isModeFinalTranscript, setIsModeFinalTranscript] = useState<boolean>(!isMobile)
    const [transcriptHistory, setTranscriptHistory] = useState<{ uuid: number, finalTranscript1: string, translation: string, fromLang: string, toLang: string }[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);

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
    let finalTranscript1 = isModeFinalTranscript ? finalTranscript : transcript

    const getListeningOptions = useCallback((): ListeningOptions => {
        return { language: fromLang, interimResults: false, continuous: false }
    }, [fromLang])

    useEffect(() => {
        let ignore = false;
        const freeSpeech =
            (text: string) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = toLang;
                if (availableVoices) {
                    const voice = getVoice(toLang)
                    utterance.voice = voice || null
                } else {
                    console.warn('no voices available')
                }

                speechSynthesis.speak(utterance)
                utterance.onstart = function (ev) { setIsSpeaking(true) }
                utterance.onend = function (ev) {
                    console.log('finished speaking and start listening again')
                    setIsSpeaking(false)
                    SpeechRecognition.startListening({ language: fromLang, interimResults: false, continuous: false })
                }
            }
        async function func() {
            if (finalTranscript1 && (transcriptHistory.length ? finalTranscript1 !== transcriptHistory[transcriptHistory.length - 1].finalTranscript1 : true)) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscript1, fromLang, toLang })
                    if (ignore) return
                    console.log('setTranslation', translationResult)

                    setTranslation(translationResult)
                    setTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: translationResult, fromLang: fromLang, toLang: toLang }])
                    SpeechRecognition.abortListening().then(() => {
                        freeSpeech(translationResult);
                    }).catch(e => {
                        console.error(e.message)
                    })
                } else {
                    setTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscript1: finalTranscript1, translation: '', fromLang: fromLang, toLang: toLang }])
                    SpeechRecognition.abortListening().then(() => {
                        freeSpeech(finalTranscript1)
                    }).catch(e => {
                        console.error(e.message)
                    })
                }
            }
        }
        func()
        return () => {
            ignore = true;
        }
    }, [finalTranscript1, fromLang, toLang, transcriptHistory, setTranscriptHistory])


    useEffect(() => {
        async function startListening() {
            try {
                await SpeechRecognition.startListening(getListeningOptions());
                console.log('Started listening');
            } catch (error) {
                console.error(error);
            }
        }

        if (!isSpeaking && !listening) { startListening(); }
    }, [listening, getListeningOptions, isSpeaking]);



    if (!browserSupportsSpeechRecognition) {
        console.error('Your browser does not support speech recognition!')
        return null
    }

    return (
        <div>
            <p>Microphone: {listening ? 'on' : 'off'}</p>
            <button onClick={SpeechRecognition.stopListening}>Stop</button>
            <button disabled={listening} onClick={() => SpeechRecognition.startListening(getListeningOptions())}>Start</button>
            <button onClick={resetTranscript}>Reset Transcript</button>

            <VoicesDropdownSelect voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                setSelectedVoice={setSelectedVoice} />

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript1:</label>
                    <input type="text" value={transcriptHistory.length ? transcriptHistory[transcriptHistory.length - 1].finalTranscript1 : ''} style={{ marginLeft: 'auto' }} readOnly />
                </div>
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


                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>fromLang:</label>
                    <input type="text" value={fromLang} style={{ marginLeft: 'auto' }} readOnly />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>toLang:</label>
                    <input type="text" value={toLang} style={{ marginLeft: 'auto' }} readOnly />
                </div>
            </div>
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
                    {transcriptHistory.reverse().map((r, i) => <tr key={r.uuid}>
                        <td>{i}</td>
                        <td>{r.fromLang}</td>
                        <td>{r.toLang}</td>
                        <td>{r.finalTranscript1}</td>
                        <td>{r.translation}</td>
                    </tr>)}
                </tbody>
            </table>
        </div>
    );
}



function getVoice(language: string): SpeechSynthesisVoice {
    if (cachedVoices.hasOwnProperty(language)) {
        console.log('return voice', { cached_voice: cachedVoices[language] }); return cachedVoices[language]
    }
    const lowercasedLanguage = language.replace('_', '-')
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
