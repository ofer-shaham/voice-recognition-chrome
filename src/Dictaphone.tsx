
// import "regenerator-runtime/runtime";
import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "./types/speechRecognition";
import VoicesDropdownSelect from "./voicesDropdownSelector";
import { availableVoices } from './services/AvailableVoices';


const fromLangInit = 'English' //'Hebrew'
const toLangInit = 'English' //'Russian'

const cachedVoices: any = {}

//load available voices


export default function LanguageDashboard() {

    const [fromLang, setFromLang] = useState(mapLanguageToCode(fromLangInit))
    const [toLang, setToLang] = useState(mapLanguageToCode(toLangInit))
    const [translation, setTranslation] = useState('')
    const [transcriptHistory, setTranscriptHistory] = useState<{ finalTranscript: string, translation: string, fromLang: string, toLang: string }[]>([])
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
                    // const voice = voices.find(v => v.lang === toLang)
                    // Object.setPrototypeOf(voice, voiceProtoRef.current || null)
                    utterance.voice = voice || null
                    // console.log({ voice, selectedVoice })
                }
                setIsSpeaking(true)
                speechSynthesis.speak(utterance)

                utterance.onend = function (ev) {
                    console.log('finished speaking and start listening again')
                    setIsSpeaking(false)
                    SpeechRecognition.startListening({ language: fromLang, interimResults: false, continuous: false })
                }
            }
        async function func() {
            if (finalTranscript && (transcriptHistory.length ? finalTranscript !== transcriptHistory[transcriptHistory.length - 1].finalTranscript : true)) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscript, fromLang, toLang })
                    console.log('setTranslation', translationResult)

                    //when new transcription arrives - speak it 
                    setTranslation(translationResult)
                    setTranscriptHistory(prev => [...prev, { finalTranscript: finalTranscript, translation: translationResult, fromLang: fromLang, toLang: toLang }])
                    SpeechRecognition.abortListening().then(() => {
                        if (!ignore) { freeSpeech(translationResult); }
                    }).catch(e => {
                        console.error(e.message)
                    })

                } else {
                    setTranscriptHistory(prev => [...prev, { finalTranscript: finalTranscript, translation: '', fromLang: fromLang, toLang: toLang }])
                    SpeechRecognition.abortListening().then(() => {
                        freeSpeech(finalTranscript)
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
    }, [finalTranscript, fromLang, toLang, transcriptHistory, setTranscriptHistory])


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
            {/* iterate the list: transcriptHistory, use rtl direction depand on the language , show a table with header:fromLang,toLang*/}
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
                    {transcriptHistory.map((r, i) => <tr key={i}>
                        <td>{i}</td>
                        <td>{r.fromLang}</td>
                        <td>{r.toLang}</td>
                        <td>{r.finalTranscript}</td>
                        <td>{r.translation}</td>


                    </tr>)}
                </tbody>
            </table>
        </div>
    );
}



function getVoice(language: string): SpeechSynthesisVoice {
    if (cachedVoices.hasOwnProperty(language)) { return cachedVoices[language] }
    const lowercasedLanguage = language.replace('_', '-')
    const filteredVoices = availableVoices.filter((r: SpeechSynthesisVoice) => r.lang === lowercasedLanguage)
    const length = filteredVoices.length
    const voice = filteredVoices[Math.floor(Math.random() * length)]
    //cache voice
    cachedVoices[language] = voice
    return voice
}


const mapLanguageToCode = (language: string): string => {
    //pick language code
    switch (language.toLowerCase()) {
        case 'hebrew':
            return 'he-IL'
        //add polland
        case 'polish':
            return 'pl-PL'
        // return 'iw-IL'
        case 'english':
            return 'en-US'
        case 'french':
            return 'fr-FR'
        case 'spanish':
            return 'es-ES'
        case 'german':
            return 'de-DE'
        case 'portuguese':
            return 'pt-PT'
        case 'russian':
            return 'ru-RU'
        case 'chinese':
            return 'zh-CN'
        case 'japanese':
            return 'ja-JP'
        case 'korean':
            return 'ko-KR'
        case 'arabic':
            return 'ar-SA'
        default:
            return 'en-US'
    }
}

const translate = ({ finalTranscript, fromLang, toLang }: { finalTranscript: string, fromLang: string, toLang: string }): Promise<string> => {
    //fetch result using free google api:
    return fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(finalTranscript)}`)
        .then(res => res.json())
        .then(data => {
            const y = data[0][0][0]
            return y
        }) // data[0].map((t: any[]) => t[0]).join('')
        .catch(err => {
            console.error(err.message); return `error, ${err.message}`
        })
}
