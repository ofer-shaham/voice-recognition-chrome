import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { populateAvailableVoices } from '../../utils/getVoice';
import Instructions from './Instructions';
import TranscriptOptions from './TranscriptOptions';
import TranscriptLive from './TranscriptLive';
// import RangeInput from './RangeInput';
import StartAndStopButtons from './StartAndStopButtons';
import DebugModeSwitch from '../LogAndDebugComponents/DebugModeSwitch';
import { SpeakLog } from '../LogAndDebugComponents/SpeakLog';
import { freeSpeak } from '../../utils/freeSpeak';
import Debug from '../../Debug';
import { getLangCodeOnMobile } from '../../utils/getLangCodeOnMobile';

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


    const [fromLang, setFromLang] = useState('he-IL')
    const [toLang, setToLang] = useState('ar-AE')
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
    const availableVoicesCode = useMemo(() => availableVoices.map(r => r.lang), [availableVoices])

    const handleStopListening = useCallback(() => {
        SpeechRecognition.stopListening()
    }, [])


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
            command: '(‏) (please) speak english',
            callback: () => {
                ;
                const langCode = mapLanguageToCode('english')
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
            },
            matchInterim: true
        }, {
            command: '(‏) (please) speak :language',
            callback: (language: string) => {

                const langCode = mapLanguageToCode(language)
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
                console.log('match :languge')
            },
            matchInterim: true
        }, {
            command: '(‏)speak english',
            callback: () => {
                const langCode = mapLanguageToCode('english')
                setFromLang(langCode);
                setToLang(langCode);
                setTranslation('')
                console.log('matchInterim')
            },
            matchInterim: true
        },
        {
            command: ['up', 'down', 'left', 'right'],
            callback: (command) => console.info(`Best matching command: ${command}`),
            isFuzzyMatch: true,
            fuzzyMatchingThreshold: 0.8,
            bestMatchOnly: true
        },
        {
            command: ['שמאל', 'ימין', 'למעלה', 'למטה'],
            callback: (command) => console.info(`Best matching command: ${command}`),
            isFuzzyMatch: true,
            fuzzyMatchingThreshold: 0.8,
            bestMatchOnly: true
        },
        {
            command: 'clear',
            callback: ({ resetTranscript }) => { console.info('got command: clear'); resetTranscript() }
        }
    ], [])

    const { finalTranscript,
        interimTranscript,
        transcript,
        listening,
        resetTranscript, isMicrophoneAvailable,
        browserSupportsSpeechRecognition } = useSpeechRecognition({ commands })

    useEffect(() => {
        if (!availableVoices.length) { console.warn('no voices') }
        else {
            populateAvailableVoices(availableVoices)
            console.info('some voices', { availableVoices })
        }
    }, [availableVoices])

    // useEffect(() => {
    //     if (isSpeaking !== !speechSynthesis.speaking) {
    //         console.error('wierd status: isSpeakig:' + (isSpeaking ? 'yes' : 'no'))
    //         // alert('force cancel speech')
    //         // speechSynthesis.resume();
    //         // speechSynthesis.cancel();
    //     }
    // }, [isSpeaking])

    const listeningOptions = useMemo((): ListeningOptions => {
        return { language: fromLang, interimResults: isInterimResults, continuous: isContinuous }
    }, [fromLang, isContinuous, isInterimResults])

    const listenNow = useCallback((): Promise<void> => {
        try {

            return SpeechRecognition.startListening(listeningOptions)
        } catch (e) {
            console.error(e);
            return Promise.reject(e)
        }
    }, [listeningOptions])

    useEffect(() => {
        try {
            listenNow();
        } catch (e) {
            console.error(e)
        }

    }, [listenNow])

    const startListening = useCallback((): Promise<void> | never => {
        return SpeechRecognition.startListening(listeningOptions).catch(e => { throw new Error(e.message) });
    }, [listeningOptions])



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
        const target = finalTranscriptHistory[finalTranscriptHistory.length - 1];

        let targetText: string | null = null
        let targetLang: string | null = null
        //set target text and language
        if (target.translation) {
            targetText = target.translation
            targetLang = target.toLang
        } else {
            targetText = target.finalTranscriptProxy
            targetLang = target.fromLang
        }

        if (!targetText || !targetLang) return
        if (!availableVoicesCode.includes(getLangCodeOnMobile(targetLang, isMobile))) {
            console.log('there is no voice for lang:' + targetLang)
            return
        }


        const speakIt = async () => {
            setIsSpeaking(true);

            try {
                await SpeechRecognition.abortListening();
                await freeSpeak(targetText as string, targetLang as string);
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
    }, [finalTranscriptHistory, availableVoicesCode]);





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
        if (!finalTranscriptProxy) { return; };
        console.log('translate', { finalTranscriptProxy })
        // let ignore = false;

        async function doTranslate() {
            const newFinalArrived = (finalTranscriptHistory.length ? finalTranscriptProxy !== finalTranscriptHistory[finalTranscriptHistory.length - 1].finalTranscriptProxy : true)
            if (newFinalArrived) {
                if (fromLang !== toLang) {
                    const translationResult = await translate({ finalTranscriptProxy, fromLang, toLang })
                    // if (ignore) return
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
            console.log('doTranslate')
            // if (finalTranscriptProxy) { ignore = true }
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


            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                {/* <VoicesDropdownSelect isMobile={isMobile} voices={availableVoices} toLang={toLang} setToLang={setToLang} selectedVoice={selectedVoice}
                    setSelectedVoice={setSelectedVoice} /> */}
                <div style={{ display: 'flex', flexDirection: 'row', width: '100%' }}>

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




