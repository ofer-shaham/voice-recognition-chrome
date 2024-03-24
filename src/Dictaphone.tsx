
import "regenerator-runtime/runtime";


import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "./types/speechRecognition";


const fromLangInit = 'Hebrew'
const toLangInit = 'Russian'
export default function LanguageDashboard() {

    // const [message, setMessage] = useState('')
    const [fromLang, setFromLang] = useState(mapLanguageToCode(fromLangInit))
    const [toLang, setToLang] = useState(mapLanguageToCode(toLangInit))
    //translation
    const [translation, setTranslation] = useState('')

    const [transcriptHistory, setTranscriptHistory] = useState<{ finalTranscript: string, translation: string, fromLang: string, toLang: string }[]>([])
    //set isSpeaking
    // const [isSpeaking, setIsSpeaking] = useState(false)


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
        // interimTranscript,transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })

    const getListeningOptions = useCallback((): ListeningOptions => {
        return { language: fromLang, interimResults: false, continuous: false }
    }, [fromLang])

    const freeSpeech = useCallback(
        (text: string) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = toLang;
            utterance.voice = getVoice(toLang)
            speechSynthesis.speak(utterance)
            utterance.onend = function (ev) {
                console.log('finished speaking and start listening again')
                SpeechRecognition.startListening({ language: fromLang, interimResults: false, continuous: false })
            }
        },
        [fromLang,
            toLang

        ]
    )


    // (fromLang: string, toLang: string, text: string) => {
    //     const utterance = new SpeechSynthesisUtterance(text);
    //     utterance.lang = toLang;
    //     utterance.voice = getVoice(toLang)
    //     speechSynthesis.speak(utterance)
    //     utterance.onend = function (ev) {
    //         console.log('finished speaking')
    //         SpeechRecognition.startListening({ language: fromLang, interimResults: false, continuous: false })
    //     }
    // }
    useEffect(() => {
        async function func() {
            if (finalTranscript) {
                //        console.log( {finalTranscript, interimTranscript,transcript})

                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscript, fromLang, toLang })
                    console.log('setTranslation', translationResult)

                    //when new transcription arrives - speak it out using speech syntesys.
                    setTranslation(translationResult)
                    setTranscriptHistory([...transcriptHistory, { finalTranscript: finalTranscript, translation: translation, fromLang: fromLang, toLang: toLang }])
                    SpeechRecognition.abortListening().then(() => {
                        freeSpeech(translationResult);
                    

                    }).catch(e=>{
                        console.log(e.message)
                    })

                } else {
                    setTranscriptHistory([...transcriptHistory, { finalTranscript: finalTranscript, translation: '', fromLang: fromLang, toLang: toLang }])

                    SpeechRecognition.abortListening().then(() => {
                        freeSpeech(finalTranscript)
                    }).catch(e=>{
                        console.log(e.message)
                    })
                }
            }
        }
        func()

    }, [finalTranscript, fromLang, toLang, freeSpeech, translation])


    useEffect(() => {
        // Make sure speech recognition is not running


        async function startListening() {
            try {
                await SpeechRecognition.startListening(getListeningOptions());
                console.log('Started listening');
            } catch (error) {
                console.error(error);
            }
        }

        startListening();

        // Return a cleanup function to stop listening when the component unmounts or when the `listening` prop changes
        return () => {
            if (listening) {
                SpeechRecognition.abortListening();
                console.log('Abort listening');
            }
        };
    }, [listening, getListeningOptions]);



    if (!browserSupportsSpeechRecognition) {
        console.error('Your browser does not support speech recognition!')
        return null
    }

    // function getListeningOptions(): ListeningOptions {
    //     return { language: fromLang, interimResults: false, continuous: false }
    // }

    return (
        <div>
            <p>Microphone: {listening ? 'on' : 'off'}</p>
            <button onClick={SpeechRecognition.stopListening}>Stop</button>
            <button onClick={() => SpeechRecognition.startListening(getListeningOptions())}>Start</button>
            <button onClick={resetTranscript}>Reset Transcript</button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>finalTranscript:</label>
                    <input type="text" value={finalTranscript} style={{ marginLeft: 'auto' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>translation:</label>
                    <input type="text" value={translation} style={{ marginLeft: 'auto' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>fromLang:</label>
                    <input type="text" value={fromLang} style={{ marginLeft: 'auto' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <label style={{ marginRight: '10px' }}>toLang:</label>
                    <input type="text" value={toLang} style={{ marginLeft: 'auto' }} />
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
function getVoice(language: string) {
    const cachedVoices: any = {}

    if (cachedVoices.hasOwnProperty(language)) { return cachedVoices[language] }

    const lowercasedLanguage = language.replace('_', '-')
    const voices = speechSynthesis.getVoices();
    const filteredVoices = voices.filter(r => r.lang === lowercasedLanguage)
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
        .then(data => data[0][0][0]) // data[0].map((t: any[]) => t[0]).join('')
        .catch(err => {
            console.error(err.message); return `error, ${err.message}`
        })
}