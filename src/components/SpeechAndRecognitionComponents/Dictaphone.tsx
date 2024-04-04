import { useCallback, useEffect, useState } from 'react'
import SpeechRecognition, { ListeningOptions, useSpeechRecognition } from 'react-speech-recognition'
import { Command } from "../../types/speechRecognition";
// import VoicesDropdownSelect from "./voicesDropdownSelector";
import { isMobile } from '../../services/isMobile';

import TranscriptHistory from './TranscriptHistory';
import TranslationBox from './TranslationBox';

// import { freeSpeak } from '../../../utils/freeSpeak'
import { translate } from '../../utils/translate';
import { mapLanguageToCode } from '../../utils/mapLanguageToCode';
import { DELAY_LISTENING_RESTART, MAX_DELAY_BETWEEN_RECOGNITIONS, instructions } from '../../consts/config';
import { useAvailableVoices } from '../../hooks/useAvailableVoices';
import { setAvailableVoices } from '../../utils/getVoice';
import Instructions from './Instructions';
import TranscriptOptions from './TranscriptOptions';
import TranscriptLive from './TranscriptLive';
// import RangeInput from './RangeInput';
import StartAndStopButtons from './StartAndStopButtons';
import DebugModeSwitch from '../LogAndDebugComponents/DebugModeSwitch';
import { SpeakLog } from '../LogAndDebugComponents/SpeakLog';
import { freeSpeak } from '../../utils/freeSpeak';
import Debug from '../../Debug';

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
    const [toLang, setToLang] = useState('en-US')
    const [translation, setTranslation] = useState('')
    const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<FinalTranscriptHistory[]>([])
    const [isSpeaking, setIsSpeaking] = useState(false)
    // const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
    const [isInterimResults, setIsInterimResults] = useState(false)
    const [isContinuous, setIsContinuous] = useState(false)
    const [finalTranscriptProxy, setFinalTranscriptProxy] = useState('');
    // const [prevTranscript, setPrevTranscript] = useState('');
    // const [prevTranscriptTime, setPrevTranscriptTime] = useState<[number, number]>([Date.now(), Date.now()]);

    const [isModeDebug, setIsModeDebug] = useState(false)
    // const [maxDelayBetweenRecognitions, setMaxDelayBetweenRecognitions] = useState(MAX_DELAY_BETWEEN_RECOGNITIONS)

    const availableVoices = useAvailableVoices();



    const commands: Command[] = [
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
        }, {
            command: '(‏)speak english',
            callback: () => {
                const langCode = mapLanguageToCode('english')
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            },
            matchInterim: true
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
        if (isSpeaking !== !speechSynthesis.speaking) {
            console.error('wierd status: isSpeakig:' + (isSpeaking ? 'yes' : 'no'))
            // alert('force cancel speech')
            // speechSynthesis.resume();
            // speechSynthesis.cancel();
        }
    }, [isSpeaking])

    // useEffect(() => {
    //     if (prevTranscriptTime[0] - prevTranscriptTime[1] > MAX_DELAY_BETWEEN_RECOGNITIONS * 1000) {
    //         resetTranscript()
    //         console.log('longer than ', MAX_DELAY_BETWEEN_RECOGNITIONS)
    //     }
    // }, [prevTranscriptTime, resetTranscript])

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
        if (isMobile) { console.info('finally arrive', { finalTranscript }) };
        setFinalTranscriptProxy(finalTranscript);
        console.log('setFinalTranscriptProxy', { finalTranscript })
    }, [finalTranscript, setFinalTranscriptProxy])

    /**
     * speak the last peece of history
     * change state: isSpeaking
     * 
     */
    useEffect(() => {
        if (!finalTranscriptHistory.length) {
            console.log('finalTranscriptHistory is empty')
            return
        };

        const speakIt = async () => {
            const target = finalTranscriptHistory[finalTranscriptHistory.length - 1];
            setIsSpeaking(true);

            try {
                await SpeechRecognition.abortListening();
                await freeSpeak(target.translation || target.finalTranscriptProxy, target.toLang);
                setIsSpeaking(false);
            } catch (error) {
                console.error(error);
                if (error === "not-allowed") {
                    throw new Error('please tap on the page to permit access to microphone');
                }
                // One must click on the page in order to permit speech Synthesis
                setIsSpeaking(false);
            }
        };

        speakIt();
    }, [finalTranscriptHistory]);



    /**
     * keep transcript that haven't reach the final stage
     * on mobile - advance it to final stage
     */
    // useEffect(() => {
    //     if (!isMobile) return
    //     const completlyNewTranscript = !transcript.includes(prevTranscript)
    //     const alreadyStagedTranscript = finalTranscriptProxy === prevTranscript
    //     const keepSurvivorBeforeLost = completlyNewTranscript && !alreadyStagedTranscript

    //     //keep transcription that missed the final stage
    //     if (keepSurvivorBeforeLost) {
    //         //on mobile we need to compansate for delayed resetTranscript scheduler
    //         console.warn('skeep saving:' + prevTranscript)
    //         //setFinalTranscriptProxy(prevTranscript);
    //     }
    //     setPrevTranscriptTime(prev => [prev[1], Date.now()])
    //     setPrevTranscript(transcript)
    // }, [
    //     finalTranscriptProxy, prevTranscript, transcript
    // ])

    /**
     * on mobile - if transcript change 
     */
    // useEffect(() => {
    //     if (!isMobile) return

    //     if (prevTranscriptTime[0] - prevTranscriptTime[1] > maxDelayBetweenRecognitions)
    //         console.log('resetTranscript')
    //     resetTranscript()
    // }, [prevTranscriptTime, maxDelayBetweenRecognitions, resetTranscript])

    /*
    throttle transcript (resetTranscript will mv the data the finalTranscript )
    */
    useEffect(() => {
        if (!isMobile) return;
        const delay = MAX_DELAY_BETWEEN_RECOGNITIONS; // Delay in milliseconds
        let timerId: NodeJS.Timeout | null = null;

        if (transcript) {
            timerId = setTimeout(() => {
                resetTranscript();
            }, delay);
        }

        return () => {
            timerId && clearTimeout(timerId);
        };
    }, [transcript, resetTranscript]);

    /*
     update history. 
     */
    useEffect(() => {
        if (!finalTranscriptProxy) { console.log({ finalTranscript }, { finalTranscriptProxy }); return };
        let ignore = false;

        async function doTranslate() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscriptProxy !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : true)
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscriptProxy, fromLang, toLang })
                    if (ignore) return
                    console.log('setTranslation', translationResult)

                    setTranslation(translationResult)
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: translationResult, fromLang: fromLang, toLang: toLang }])

                } else {
                    setFinalTranscriptHistory(prev => [...prev, { uuid: Date.now(), finalTranscriptProxy: finalTranscriptProxy, translation: '', fromLang: fromLang, toLang: toLang }])

                }
            }
        }
        doTranslate()
        return () => {
            if (finalTranscriptProxy) { ignore = true }
        }
    }, [finalTranscriptProxy, fromLang, toLang, finalTranscriptHistory, setFinalTranscriptHistory])




    useEffect(() => {
        let timeoutId: NodeJS.Timeout | null = null


        if (!isSpeaking && !listening) {

            timeoutId = setTimeout(listenNow, isMobile ? DELAY_LISTENING_RESTART : 0)
        }
        return () => { timeoutId && clearTimeout(timeoutId) }
    }, [isSpeaking, startListening, listening, listenNow]);







    if (!browserSupportsSpeechRecognition) {
        alert('Your browser does not support speech recognition!')
        return null
    }


    const handleStopListening = () => {
        SpeechRecognition.stopListening()
    }

    return (

        <div style={{ background: (isSpeaking ? 'blue' : (listening ? 'green' : 'grey')) }}>

            <Instructions instructions={instructions} />
            <SpeakLog setIsSpeaking={setIsSpeaking} isSpeaking={isSpeaking} />
            <p>Is Speaking: {isSpeaking ? 'Yes' : 'No'}</p>
            <Debug isModeDebug={isModeDebug}>
                <div id="read_only_flags" >
                    <p>is Microphone Available: {isMicrophoneAvailable ? 'yes' : 'no'}</p>
                    <p>listening: {listening ? 'yes' : 'no'}</p>
                    <p>speaking: {isSpeaking ? 'yes' : 'no'}</p>
                </div>
            </Debug>

            <StartAndStopButtons
                listening={listening}
                listenNow={listenNow}
                resetTranscript={resetTranscript}
                setFromLang={setFromLang}
                setToLang={setToLang}
                setTranslation={setTranslation}
                handleStopListening={handleStopListening}
            />

            <TranscriptOptions
                isModeDebug={true}
                isInterimResults={isInterimResults}
                setIsInterimResults={setIsInterimResults}
                isContinuous={isContinuous}
                setIsContinuous={setIsContinuous}
            />
            <DebugModeSwitch isModeDebug={isModeDebug} setIsModeDebug={setIsModeDebug} />
            <TranscriptLive finalTranscript={finalTranscript} interimTranscript={interimTranscript} transcript={transcript} isModeDebug={isModeDebug} />


            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {/* <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                    setSelectedVoice={setSelectedVoice} /> */}
                <div style={{ display: 'flex', flexDirection: 'row' }}>

                    <TranslationBox setText={setFinalTranscriptProxy} setLanguage={setFromLang} language={fromLang} text={transcript || (finalTranscriptHistory.length ? finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : '')} onfreeSpeak={freeSpeak} />

                    <TranslationBox setText={setTranslation} setLanguage={setToLang} language={toLang}
                        text={translation || ''}
                        onfreeSpeak={freeSpeak} />

                </div>
            </div>
            <TranscriptHistory finalTranscriptHistory={finalTranscriptHistory} isModeDebug={isModeDebug} />
            {/* {isMobile && (
                <RangeInput maxDelayBetweenRecognitions={maxDelayBetweenRecognitions} prevTranscriptTime={prevTranscriptTime} setMaxDelayBetweenRecognitions={setMaxDelayBetweenRecognitions} />
            )} */}
            <div id='footer' style={{ display: 'flex' }}>
                <a href="https://github.com/ofer-shaham/voice-recognition-chrome">source code</a>
            </div>
        </div>
    )


}




