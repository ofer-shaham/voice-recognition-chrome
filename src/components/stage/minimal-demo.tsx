import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition';
import { useRecognitionEvents } from '../../hooks/useRecognitionEvents';
import { Logger } from '../LogAndDebugComponents/Logger';
import RangeInput from '../SpeechAndRecognitionComponents/RangeInput';
import { INITIAL_DELAY_BETWEEN_WORDS } from '../../consts/config';
import { translate } from '../../utils/translate';
import { isMobile } from '../../services/isMobile';
import { freeSpeak } from '../../utils/freeSpeak';
import { useAvailableVoices } from '../../hooks/useAvailableVoices';
import { populateAvailableVoices } from '../../utils/getVoice';
import { mapLanguageToCode } from '../../utils/mapLanguageToCode';
import { Command } from '../../types/speechRecognition';

const ExampleKit = () => {
    const [transcribing, setTranscribing] = useState(true);
    const [clearTranscriptOnListen, setClearTranscriptOnListen] = useState(true);

    const [logMessages, setLogMessages] = useState<any[]>([]);
    const [isContinuous, setIsContinuous] = useState(true);

    const [isInterimResults, setIsInterimResults] = useState(false);


    const [fromLang, setFromLang] = useState('he-IL')

    const [toLang, setToLang] = useState(isMobile ? 'ar-AE' : 'ru-RU')
    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [translation, setTranslation] = useState('')
    const availableVoices = useAvailableVoices();
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
    ], [])

    const {

        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition({ clearTranscriptOnListen, commands, transcribing });
    // Set events handlers
    useRecognitionEvents(SpeechRecognition);

    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const handleStartListening = useCallback(() => {
        return SpeechRecognition.startListening(listeningOptions);
    }, [listeningOptions]);


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




    /*
transcript translation
    */
    useEffect(() => {
        async function appendToHistory() {
            // if (finalTranscriptProxy.includes('-')) {
            //     debugger
            // }
            console.log('slice', finalTranscriptProxy.slice(0, 1) === '-')
            let finalTranscriptProxyTmp = ''
            if (finalTranscriptProxy.slice(0, 1) === '-') {
                finalTranscriptProxyTmp = finalTranscriptProxy.slice(1);
            } else {
                finalTranscriptProxyTmp = finalTranscriptProxy;
            }

            const translationResult = await translate({ finalTranscriptProxy: finalTranscriptProxyTmp, fromLang, toLang })
            if (translationResult) {
                setTranslation(translationResult)
            }
        }
        if (finalTranscriptProxy) {
            appendToHistory()
        }
    }, [finalTranscriptProxy, fromLang, toLang]);

    useEffect(() => {
        const speakTranslation = async (text: string, lang: string) => {

            // await SpeechRecognition.stopListening().catch(e => console.error('stopListening', e));
            // setClearTranscriptOnListen(() => false)
            setTranscribing(() => false)
            // setTimeout(async () => {
            console.log('speak: __/' + text + '\\__')
            await freeSpeak(text, lang).catch(e => console.error(e.message))
            // handleStartListening()
            setTranscribing(true)
            // setClearTranscriptOnListen(true)
            // })


        }
        if (translation) {

            speakTranslation(translation, toLang)
        }
    }, [translation, toLang, handleStartListening]);




    useEffect(() => {
        handleStartListening()
    }, [handleStartListening])


    /*
    force recycle of current transcript 
    */
    useEffect(() => {
        const delay = delayBetweenWords; // Delay in milliseconds
        let timerId: NodeJS.Timeout | null = null;

        if (transcript && transcript !== '-') {
            timerId = setTimeout(() => {
                console.log({ finish: transcript })
                setFinalTranscriptProxy(transcript)
                resetTranscript();
            }, delay);
        }

        return () => {
            timerId && clearTimeout(timerId);
        };
    }, [transcript, resetTranscript, delayBetweenWords]);




    useEffect(() => {
        handleStartListening()
    }, [handleStartListening])

    if (!browserSupportsSpeechRecognition) {
        return <span style={{ color: 'red' }}>Browser doesn't support speech recognition.</span>;
    }
    return (
        <div>
            <p style={{ color: 'blue' }}>listening: {listening ? 'on' : 'off'}</p>
            <div>
                <label htmlFor="transcribing">transcribing:</label>
                <input
                    id="transcribing"
                    type="checkbox"
                    checked={transcribing}
                    onChange={(e) => setTranscribing(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="clearTranscriptOnListen">clearTranscriptOnListen:</label>
                <input
                    id="clearTranscriptOnListen"
                    type="checkbox"
                    checked={clearTranscriptOnListen}
                    onChange={(e) => setClearTranscriptOnListen(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="continuous">Continuous:</label>
                <input
                    id="continuous"
                    type="checkbox"
                    checked={isContinuous}
                    onChange={(e) => setIsContinuous(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="interimResults">Interim Results:</label>
                <input
                    id="interimResults"
                    type="checkbox"
                    checked={isInterimResults}
                    onChange={(e) => setIsInterimResults(e.target.checked)}
                />
            </div>
            <div>
                <label htmlFor="language">Language:</label>
                <select
                    id="language"
                    value={fromLang}
                    onChange={(e) => setFromLang(e.target.value)}
                >
                    <option value="en-US">English (US)</option>
                    <option value="es-ES">Spanish</option>
                    <option value="he-IL">Hebrew</option>
                    {/* Add more language options here */}
                </select>
            </div>
            <button
                style={{ backgroundColor: 'green', color: 'white' }}
                disabled={listening}
                onClick={handleStartListening}
            >
                Start
            </button>
            <button
                style={{ backgroundColor: 'red', color: 'white' }}
                disabled={!listening}
                onClick={SpeechRecognition.stopListening}
            >
                Stop
            </button>
            <button
                style={{ backgroundColor: 'orange', color: 'white' }}
                onClick={resetTranscript}
            >
                Reset
            </button>
            <p style={{ color: 'darkred' }}>{translation}</p>

            <p style={{ color: 'purple' }}>{transcript}</p>
            <p style={{ color: 'darkgreen' }}>{finalTranscriptProxy}</p>

            <RangeInput delayBetweenWords={delayBetweenWords} setdelayBetweenWords={setdelayBetweenWords} />
            <Logger messages={logMessages} setMessages={setLogMessages} />
        </div>
    );
};

export default ExampleKit;