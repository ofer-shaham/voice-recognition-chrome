import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition';
import { useRecognitionEvents } from '../../hooks/useRecognitionEvents';
import Logger from '../LogAndDebugComponents/Logger';
import RangeInput from '../SpeechAndRecognitionComponents/RangeInput';
import { INITIAL_DELAY_BETWEEN_WORDS, MAX_DELAY_FOR_NOT_LISTENING } from '../../consts/config';
import { translate } from '../../utils/translate';
import { isMobile } from '../../services/isMobile';
import { freeSpeak } from '../../utils/freeSpeak';
import { useAvailableVoices } from '../../hooks/useAvailableVoices';
import { populateAvailableVoices } from '../../utils/getVoice';
import { mapLanguageToCode } from '../../utils/mapLanguageToCode';
import { Command } from '../../types/speechRecognition';
import VoicesDropdownSelect from '../SpeechAndRecognitionComponents/voicesDropdownSelector';
import TranslationBox from '../SpeechAndRecognitionComponents/TranslationBox';
import Debug from '../LogAndDebugComponents/Debug';
import DebugModeSwitch from '../LogAndDebugComponents/DebugModeSwitch';
import { FullScreen, useFullScreenHandle } from "react-full-screen";

import '../../styles/minimal-demo.css'


const ExampleKit = () => {
    const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [selectedFromLang, setSelectedFromLang] = useState<SpeechSynthesisVoice | null>(null);
    const [isModeDebug, setIsModeDebug] = useState(false)
    const handle = useFullScreenHandle();


    const [transcribing, setTranscribing] = useState(true);
    const [clearTranscriptOnListen, setClearTranscriptOnListen] = useState(false);

    const [logMessages, setLogMessages] = useState<any[]>([]);
    const [isContinuous, setIsContinuous] = useState(false);

    const [isInterimResults, setIsInterimResults] = useState(false);


    const [fromLang, setFromLang] = useState('he-IL')

    const [toLang, setToLang] = useState(isMobile ? 'ar-EG' : 'ru-RU')
    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [translation, setTranslation] = useState('')
    const availableVoices = useAvailableVoices();

    const [isUserTouchedScreen, setIsUserTouchedScreen] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false)



    const screen1 = useFullScreenHandle();


    const commands = useMemo<Command[]>(() => [
        {
            command: '(‏) (please) translate (from) * to *',
            callback: (fromLang: string, toLang: string) => {
                const fromCode = mapLanguageToCode(fromLang)
                const toCode = mapLanguageToCode(toLang)
                setFromLang(fromCode); setToLang(toCode);
                console.log(`from ${fromCode} to ${toCode}`);
                setFinalTranscriptProxy('')

            }
        },
        {
            command: '(‏) (please) speak :language',
            callback: (language: string) => {

                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
                setFinalTranscriptProxy('')
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

    const reportChange = useCallback((state: any, handle: any) => {
        if (handle === screen1) {
            console.log('Screen 1 went to', state, handle);
        }
        console.log('zzzzz')

    }, [screen1]);



    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const handleStartListening = useCallback(() => {
        return SpeechRecognition.startListening(listeningOptions);
    }, [listeningOptions]);

    const onEndHandler = useCallback(
        (eventData: Event) => {
            console.log(`event occurred:`, eventData.type, eventData);
            handleStartListening()
        }
        , [handleStartListening])



    useRecognitionEvents(SpeechRecognition, onEndHandler);

    const flaggedFreeSpeak = useCallback(async (text: string, lang: string) => {
        setTranscribing(() => false)
        setIsSpeaking(() => true)
        await freeSpeak(text, lang).catch(e => console.error(e.message))
        setIsSpeaking(() => false)
        setTranscribing(true)
    }, [])

    const onfreeSpeakOnly = useCallback(async (text: string, lang: string) => {
        //   await stopListenAndRecord()
        await flaggedFreeSpeak(text, lang)
        //   startListenAndRecord()
    }, [flaggedFreeSpeak])

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
        const handleTouchStart = () => {
            setIsUserTouchedScreen(true);
        };

        document.addEventListener('touchstart', handleTouchStart);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
        };
    }, []);



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
        const speakTranslation = (text: string, lang: string) => {
            console.log('speak: __/' + text + '\\__')
            flaggedFreeSpeak(text, lang)
        }

        if (translation) {
            speakTranslation(translation, toLang)
        }
    }, [translation, toLang, handleStartListening, flaggedFreeSpeak]);




    useEffect(() => {
        console.log('init listening')
        setTimeout(handleStartListening)

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
        if (listening || isSpeaking) { return; }

        const timoutId = setTimeout(() => {
            handleStartListening()
        }, MAX_DELAY_FOR_NOT_LISTENING);

        return () => {
            clearTimeout(timoutId)
        }

    }, [handleStartListening, listening, isSpeaking])


    if (!browserSupportsSpeechRecognition) {
        return <span style={{ color: 'red' }}>Browser doesn't support speech recognition.</span>;
    }






    return (
        <div>
            <DebugModeSwitch isModeDebug={isModeDebug} setIsModeDebug={setIsModeDebug} />
            <p>User touched screen: {isUserTouchedScreen ? 'Yes' : 'No'}</p>

            <button onClick={handle.enter}>
                Enter fullscreen
            </button>
            <FullScreen handle={screen1} onChange={reportChange}>
                {
                    transcript ?
                        <p style={{ color: 'purple' }}>{transcript}</p> :
                        <p style={{ color: 'black' }}>{finalTranscriptProxy}</p>

                }  {isSpeaking ? <p style={{ color: 'green' }}>{translation}</p> : <p style={{ color: 'black' }}>{translation}</p>
                }
            </FullScreen>
            <Debug isModeDebug={isModeDebug}>


                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                        <TranslationBox isActiveTalking={!!transcript} setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang}
                            text={transcript || finalTranscriptProxy} onfreeSpeakOnly={flaggedFreeSpeak}>
                            <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={fromLang} setToLang={setFromLang} selectedVoice={selectedFromLang}
                                setSelectedVoice={setSelectedFromLang} />
                        </TranslationBox>
                        <TranslationBox isActiveTalking={isSpeaking} setText={setTranslation} setLanguage={setToLang} language={toLang}
                            text={translation || ''}
                            onfreeSpeakOnly={onfreeSpeakOnly} >
                            <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                                setSelectedVoice={setSelectedVoice} />
                        </TranslationBox>
                    </div>
                </div>

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

                {!listening ?
                    <button
                        style={{ backgroundColor: 'green', color: 'white' }}
                        disabled={listening}
                        onClick={handleStartListening}
                    >
                        Start
                    </button> :
                    <button
                        style={{ backgroundColor: 'red', color: 'white' }}
                        disabled={!listening}
                        onClick={SpeechRecognition.stopListening}
                    >
                        Stop
                    </button>

                }

                <button
                    style={{ backgroundColor: 'orange', color: 'white' }}
                    onClick={resetTranscript}
                >
                    Reset
                </button>




                <RangeInput delayBetweenWords={delayBetweenWords} setdelayBetweenWords={setdelayBetweenWords} />

                <Logger messages={logMessages} setMessages={setLogMessages} />
            </Debug>
        </div>
    );
};

export default React.memo(ExampleKit);