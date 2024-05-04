import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition';
import { useRecognitionEvents } from '../hooks/useRecognitionEvents';
import Logger from './LogAndDebugComponents/Logger';
import RangeInput from './SpeechAndRecognitionComponents/RangeInput';
import { INITIAL_DELAY_BETWEEN_WORDS, MAX_DELAY_FOR_NOT_LISTENING, instructions, initialFromLang, initialToLang } from '../consts/config';
import { translate } from '../utils/translate';
import { freeSpeak } from '../utils/freeSpeak';
import { useAvailableVoices } from '../hooks/useAvailableVoices';
import { populateAvailableVoices } from '../utils/getVoice';
import { mapLanguageToCode } from '../utils/mapLanguageToCode';
import { Command } from '../types/speechRecognition';
import TranslationBox from './SpeechAndRecognitionComponents/TranslationBox';
import Debug from './LogAndDebugComponents/Debug';

import '../styles/mobileVer.css'
import Instructions from './SpeechAndRecognitionComponents/Instructions';
import { FinalTranscriptHistory } from '../types/FinalTranscriptHistory';
import TranscriptHistory from './SpeechAndRecognitionComponents/TranscriptHistory';
import { useSearchParams } from 'react-router-dom'
import Accordion from './LogAndDebugComponents/Accordion';
import CheckBoxSwitch from './General/checkboxSwitch';
import FullScreenMode from './General/FullScreenWrapper';
import isRtl from '../utils/isRtl';
// import { setMute, setUnmute } from '../../utils/microphone';

/**
 * NOTE:
 * - use transcribing as a listening indicator
 * 
 */
const MobileVer = () => {
    const [isModeDebug, setIsModeDebug] = useState(false)

    const [transcribing, setTranscribing] = useState(true);
    const [clearTranscriptOnListen, setClearTranscriptOnListen] = useState(false);

    const [logMessages, setLogMessages] = useState<any[]>([]);
    const [isContinuous, setIsContinuous] = useState(false);

    const [isInterimResults, setIsInterimResults] = useState(false);


    const [fromLang, setFromLang] = useState('')
    const [toLang, setToLang] = useState('')

    const fromLangClassName = isRtl(fromLang) ? 'is-rtl' : '';
    const toLangClassName = isRtl(toLang) ? 'is-rtl' : '';

    const [delayBetweenWords, setdelayBetweenWords] = useState(INITIAL_DELAY_BETWEEN_WORDS)
    const [maxDelayForNotListening, setMaxDelayForNotListening] = useState(MAX_DELAY_FOR_NOT_LISTENING)



    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    const [translation, setTranslation] = useState('')
    const availableVoices = useAvailableVoices();

    // const [isUserTouchedScreen, setIsUserTouchedScreen] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [isModeConversation, setIsModeConversation] = useState(false)

    const [showTranslationHistory, setShowTranslationHistory] = useState(true)
    // const [willAddToHistory, setWillAddToHistory] = useState(false)
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])

    // const [isSimultaneousTranslation, setIsSimultaneousTranslation] = useState(true)
    const [searchParams, setSearchParams] = useSearchParams()
    const [selectedFromVoice, setSelectedFromVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [selectedToVoice, setSelectedToVoice] = useState<SpeechSynthesisVoice | null>(null);

    useEffect(() => {
        const searchToLang = searchParams.get('to-lang') || initialToLang
        const searchFromLang = searchParams.get('from-lang') || initialFromLang
        setTimeout(
            () => {
                if (searchToLang) {
                    console.log(searchToLang)
                    setToLang(searchToLang)
                }

                if (searchFromLang) {
                    console.log(searchFromLang)
                    setFromLang(searchFromLang)
                }
            }
        )

    }, [searchParams])

    //update url based on change to source/target langs
    useEffect(() => {
        if (fromLang && toLang) {
            setSearchParams({ 'from-lang': fromLang, 'to-lang': toLang })
        }
        else if (fromLang) {
            setSearchParams({ 'from-lang': fromLang })
        }
        else if (toLang) {
            setSearchParams({ 'to-lang': toLang })
        }
    }, [toLang, fromLang, setSearchParams])

    const willAddToHistory = useMemo(() => {
        return showTranslationHistory
    }, [showTranslationHistory])

    const commands = useMemo<Command[]>(() => [
        {
            command: '(‏) (please) translate (from) * to *',
            callback: (fromLang: string, toLang: string) => {
                const fromCode = mapLanguageToCode(fromLang)
                const toCode = mapLanguageToCode(toLang)
                setFromLang(fromCode); setToLang(toCode);
                console.log(`from ${fromCode} to ${toCode}`);
                setFinalTranscriptProxy('')
                //experiment
                setClearTranscriptOnListen(true)

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
                //experiment
                setClearTranscriptOnListen(true)
                console.log('match :languge')
            },
            matchInterim: true
        },
        {
            command: 'clear clear',
            callback: ({ resetTranscript }) => {
                setTranslation('')
                setFinalTranscriptProxy('');
                resetTranscript()
            }
        }
    ], [])


    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition
    } = useSpeechRecognition({ clearTranscriptOnListen, commands, transcribing });
    // Set events handlers




    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const handleStartListening = useCallback(() => {
        return SpeechRecognition.startListening(listeningOptions);
    }, [listeningOptions]);

    const onEndHandler = useCallback(
        (eventData: Event) => {
            // console.log(`event occurred:`, eventData.type, eventData);
            console.info('start listen ofter speech ended')
            // handleStartListening()
        }
        , [
            // handleStartListening
        ])



    const switchBetweenToAndFromLangs = useCallback(() => {
        const fromLangCopy = fromLang
        setTranslation('')
        setFinalTranscriptProxy('')
        resetTranscript();

        setFromLang(toLang);
        setToLang(fromLangCopy)
    }, [fromLang, toLang, resetTranscript])

    const flaggedFreeSpeak = useCallback(async (text: string, lang: string) => {
        // setTranscribing(() => false)
        // setMute()
        setIsSpeaking(() => true)
        await freeSpeak(text, lang).catch(e => console.error(e.message))

        setIsSpeaking(() => false)
        // setTranscribing(true)
        // setUnmute()


        //setTimeout(() => {
        if (isModeConversation) {
            switchBetweenToAndFromLangs()
        }
        // })

    }, [isModeConversation, switchBetweenToAndFromLangs])


    const onfreeSpeakOnly = useCallback((text: string, lang: string) => {
        //   await stopListenAndRecord()
        flaggedFreeSpeak(text, lang)
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
            // setIsUserTouchedScreen(true);
            console.info('user touched screen')
        };

        document.addEventListener('touchstart', handleTouchStart);
        document.addEventListener('click', handleTouchStart);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('click', handleTouchStart);

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

            if (willAddToHistory) {
                setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: translationResult, fromLang: fromLang, toLang: toLang, audioData: '' }])
            }

        }
        if (finalTranscriptProxy) {
            appendToHistory()
        }
    }, [finalTranscriptProxy, fromLang, toLang, willAddToHistory]);

    useEffect(() => {
        const speakTranslation = (text: string, lang: string) => {
            console.log('speak: __/' + text + '\\__')
            flaggedFreeSpeak(text, lang)
        }

        if (translation) {
            speakTranslation(translation, toLang)
        }
    }, [translation, toLang, flaggedFreeSpeak]);

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
        if (listening || isSpeaking) { console.log({ listening, isSpeaking }); return; }

        const timoutId = setTimeout(() => {
            console.info('start listen after delay')
            handleStartListening()
        }, maxDelayForNotListening);

        return () => {
            clearTimeout(timoutId)
        }

    }, [handleStartListening, listening, isSpeaking, maxDelayForNotListening])

    useRecognitionEvents(SpeechRecognition, onEndHandler);

    //-----end useEffect
    if (!browserSupportsSpeechRecognition) {
        return <span style={{ color: 'red' }}>Browser doesn't support speech recognition.</span>;
    }

    return (
        <div className='container' style={{ background: (isSpeaking ? 'darkblue' : (listening ? 'darkgreen' : 'darkgrey')) }}>
            <div style={{ background: 'grey' }}>
                <Accordion title={'instructions'} >
                    <Instructions instructions={instructions}></Instructions>
                </Accordion>

                <button
                    type="button"
                    onClick={() => setIsModeConversation(prev => !prev)}
                    style={{ background: isModeConversation ? 'blue' : 'green' }}
                >
                    {isModeConversation ? 'conversation' : 'single talker'}
                </button>

                {/* show main text source/translation */}
                <FullScreenMode>
                    <div>
                        <div className="button-container">
                            <button className={`button`}>{fromLang}</button>
                        </div>
                        <div>
                            {transcript ? (
                                <p className={`transcript ${fromLangClassName}`}>{transcript}</p>
                            ) : (
                                <p className={`final-transcript ${fromLangClassName}`}>{finalTranscriptProxy}</p>
                            )}
                        </div>
                        <div className="button-container">
                            <div>
                                <button className={`button ${toLangClassName}`}>{toLang}</button>
                            </div>
                            <div>
                                <p className={`translation ${toLangClassName} ${isSpeaking ? 'is-speaking' : ''}`}>{translation}</p>
                            </div>
                        </div>
                    </div>
                </FullScreenMode>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>
                        <TranslationBox isActiveTalking={!!transcript} setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang}
                            text={transcript || finalTranscriptProxy} onfreeSpeakOnly={flaggedFreeSpeak} availableVoices={availableVoices} selectedVoice={selectedFromVoice} setSelectedVoice={setSelectedFromVoice} />

                        <TranslationBox isActiveTalking={isSpeaking} setText={setTranslation} setLanguage={setToLang} language={toLang}
                            text={translation || ''}
                            onfreeSpeakOnly={onfreeSpeakOnly} availableVoices={availableVoices} selectedVoice={selectedToVoice} setSelectedVoice={setSelectedToVoice} />
                    </div>
                </div>

                <Debug isModeDebug={isModeDebug}>
                    <button
                        type="button"
                        onClick={() => setShowTranslationHistory(prev => !prev)}
                        style={{ background: showTranslationHistory ? 'blue' : 'green' }}
                    >
                        showTranslationHistory {showTranslationHistory ? 'yes' : 'no'}
                    </button>


                    <RangeInput value={maxDelayForNotListening} setValue={setMaxDelayForNotListening} title='maxDelayForNotListening' />


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
                    <Logger messages={logMessages} setMessages={setLogMessages} />
                </Debug>
                <RangeInput value={delayBetweenWords} setValue={setdelayBetweenWords} title='delayBetweenWords' />

            </div>
            <CheckBoxSwitch isModeValue={isContinuous}
                setIsModeValue={setIsContinuous}
                title='continuous'
            />
            <CheckBoxSwitch isModeValue={isModeDebug} setIsModeValue={setIsModeDebug} title='Debug' />

            <Accordion title='history'>

                <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} onfreeSpeakOnly={onfreeSpeakOnly} onEndPlayback={
                    () => { console.log('implement startListenAndRecord') }
                    //startListenAndRecord
                } onBeforePlayback={() => {
                    console.log('implement stopListenAndRecord')
                }} />
            </Accordion>
        </div>
    );
};

export default React.memo(MobileVer);