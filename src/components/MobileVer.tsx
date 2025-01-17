import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import SpeechRecognition, {
  ListeningOptions,
  useSpeechRecognition,
} from "react-speech-recognition";
import { useRecognitionEvents } from "../hooks/useRecognitionEvents";
import Logger from "./LogAndDebugComponents/Logger";
import RangeInput from "./SpeechAndRecognitionComponents/RangeInput";
import {
  INITIAL_DELAY_BETWEEN_WORDS,
  MAX_DELAY_FOR_NOT_LISTENING,
  instructions,
} from "../consts/config";
import { translate } from "../utils/translate";
import { freeSpeak } from "../utils/freeSpeak";
import { useAvailableVoices } from "../hooks/useAvailableVoices";
import { populateAvailableVoices } from "../utils/getVoice";
import { mapLanguageToCode } from "../utils/mapLanguageToCode";
import { Command } from "../types/speechRecognition";
import TranslationBox from "./SpeechAndRecognitionComponents/TranslationBox";
import Debug from "./LogAndDebugComponents/Debug";

import "../styles/mobileVer.css";
import Instructions from "./SpeechAndRecognitionComponents/Instructions";
import { FinalTranscriptHistory } from "../types/FinalTranscriptHistory";
import TranscriptHistory from "./SpeechAndRecognitionComponents/TranscriptHistory";
import Accordion from "./LogAndDebugComponents/Accordion";
import CheckBoxSwitch from "./General/CheckboxSwitch";
import BugComponent from "./LogAndDebugComponents/bug";
import Todo from "./LogAndDebugComponents/mdPresenter";

import useLocalStorageScore from "../hooks/useLocalStorage";
import useLanguageSelection from "../hooks/useLanguageSelection";
import ShowTranscriptAndTranslation from "./General/TranscriptTranslationPanel";
import ShowTranscriptAndTranslationWithAnswer from "./General/TranscriptTranslationPanelWithAnswer";

import useAiFriend from "./SpeechAndRecognitionComponents/new/useSimpleAiFriend";
import SpeakMultiple from "./SpeechAndRecognitionComponents/new/SpeakMultiple";
import useSimpleAiFriend from "./SpeechAndRecognitionComponents/new/useSimpleAiFriend";
// import SpeakMultiple from "./SpeechAndRecognitionComponents/new/SpeakMultiple";
// import { setMute, setUnmute } from '../../utils/microphone';

/**
 * NOTE:
 * - use transcribing as a listening indicator
 *
 */
const MobileVer = () => {
  const [isModeDebug, setIsModeDebug] = useState(false);

  const [transcribing, setTranscribing] = useState(true);
  const [clearTranscriptOnListen, setClearTranscriptOnListen] = useState(false);

  const [logMessages, setLogMessages] = useState<any[]>([]);
  const [isContinuous, setIsContinuous] = useState(false);

  const [isInterimResults, setIsInterimResults] = useState(false);

  const [delayBetweenWords, setdelayBetweenWords] = useState(
    INITIAL_DELAY_BETWEEN_WORDS
  );
  const [maxDelayForNotListening, setMaxDelayForNotListening] = useState(
    MAX_DELAY_FOR_NOT_LISTENING
  );

  const [finalTranscriptProxy, setFinalTranscriptProxy] = useState("");
  const [myPrompt, setMyPrompt] = useState<null | string>(null);


  const [translation, setTranslation] = useState("");
  const availableVoices = useAvailableVoices();

  // const [isUserTouchedScreen, setIsUserTouchedScreen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isModeConversation, setIsModeConversation] = useState(false);
  const [speakEnable, setSpeakEnable] = useState(true);
  const [answer, setAnswer] = useState('');
  const [showTranslationHistory, setShowTranslationHistory] = useState(true);
  // const [willAddToHistory, setWillAddToHistory] = useState(false)
  const [finalTranscriptHistory, setFinalTranscriptHistory] = useState<
    FinalTranscriptHistory[]
  >([]);

  // const [isSimultaneousTranslation, setIsSimultaneousTranslation] = useState(true)
  const [selectedFromVoice, setSelectedFromVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [selectedToVoice, setSelectedToVoice] =
    useState<SpeechSynthesisVoice | null>(null);
  const [score, updateScore, resetScore] = useLocalStorageScore({
    key: "score",
    defaultValue: 0,
  });
  const scoreIncreaseRef = useRef(updateScore);
  const { fromLang, setFromLang, toLang, setToLang } = useLanguageSelection();
  const answerTmp = useSimpleAiFriend({ fromLang, inputText: finalTranscriptProxy, myPrompt });
  console.log({ answerTmp })

  // console.log({ verifiedResponse, sentences, verificationExceptions })
  const willAddToHistory = useMemo(() => {
    return showTranslationHistory;
  }, [showTranslationHistory]);

  const commands = useMemo<Command[]>(
    () => [
      {
        command: "(‏) (please) translate (from) * to *",
        callback: (fromLang: string, toLang: string) => {
          const fromCode = mapLanguageToCode(fromLang);
          const toCode = mapLanguageToCode(toLang);
          setFromLang(fromCode);
          setToLang(toCode);
          console.log(`from ${fromCode} to ${toCode}`);
          setFinalTranscriptProxy("");
          //experiment
          setClearTranscriptOnListen(true);
        },
      },
      {
        command: "(‏) (please) speak :language",
        callback: (language: string) => {
          const langCode = mapLanguageToCode(language);
          setFromLang(langCode);
          setToLang(langCode);
          setTranslation("");
          setFinalTranscriptProxy("");
          //experiment
          setClearTranscriptOnListen(true);
          console.log("match :languge");
        },
        matchInterim: true,
      },
      {
        command: "clear clear",
        callback: ({ resetTranscript }) => {
          setTranslation("");
          setFinalTranscriptProxy("");
          resetTranscript();
        },
      },
    ],
    [setFromLang, setToLang]
  );

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition({ clearTranscriptOnListen, commands, transcribing });
  // Set events handlers

  const listeningOptions = useMemo((): ListeningOptions => {
    return {
      language: fromLang,
      interimResults: isInterimResults,
      continuous: isContinuous,
    };
  }, [fromLang, isContinuous, isInterimResults]);

  const handleStartListening = useCallback(() => {
    return SpeechRecognition.startListening(listeningOptions);
  }, [listeningOptions]);

  const onEndHandler = useCallback(
    (eventData: Event) => {
      // console.log(`event occurred:`, eventData.type, eventData);
      console.info("start listen ofter speech ended");
      // handleStartListening()
    },
    [
      // handleStartListening
    ]
  );

  const switchBetweenToAndFromLangs = useCallback(() => {
    const fromLangCopy = fromLang;
    setTranslation("");
    setFinalTranscriptProxy("");
    resetTranscript();

    setFromLang(toLang);
    setToLang(fromLangCopy);
  }, [fromLang, toLang, resetTranscript, setFromLang, setToLang]);

  const flaggedFreeSpeak = useCallback(
    async (text: string, lang: string) => {
      // setTranscribing(() => false)
      // setMute()
      setIsSpeaking(() => true);
      await freeSpeak(text, lang).catch((e) => console.error(e.message));

      setIsSpeaking(() => false);
      // setTranscribing(true)
      // setUnmute()

      //setTimeout(() => {
      if (isModeConversation) {
        switchBetweenToAndFromLangs();
      }
      // })
    },
    [isModeConversation, switchBetweenToAndFromLangs]
  );

  const onfreeSpeakOnly = useCallback(
    (text: string, lang: string) => {
      //   await stopListenAndRecord()
      console.log('onfreeSpeakOnly', text, lang)
      flaggedFreeSpeak(text, lang);
      //   startListenAndRecord()
    },
    [flaggedFreeSpeak]
  );

  useEffect(() => { if (answerTmp.length) { setAnswer(answerTmp) }; console.log({ answer }) }, [answerTmp])
  /*
   * update devices' available voices
   */
  useEffect(() => {
    if (!availableVoices.length) {
      console.warn("no voices");
    } else {
      populateAvailableVoices(availableVoices);
      console.info("some voices", { availableVoices });
    }
  }, [availableVoices]);

  useEffect(() => {
    const handleTouchStart = () => {
      // setIsUserTouchedScreen(true);
      console.info("user touched screen");
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("click", handleTouchStart);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("click", handleTouchStart);
    };
  }, []);

  /*
    transcript translation
    */
  useEffect(() => {
    async function appendToHistory() {
      debugger
      console.log("slice", finalTranscriptProxy.slice(0, 1) === "-");
      let finalTranscriptProxyTmp = "";
      if (finalTranscriptProxy.slice(0, 1) === "-") {
        finalTranscriptProxyTmp = finalTranscriptProxy.slice(1);
      } else {
        finalTranscriptProxyTmp = finalTranscriptProxy;
      }

      const translationResult = await translate({
        finalTranscriptProxy: finalTranscriptProxyTmp,
        fromLang,
        toLang,
      });
      if (translationResult) {
        setTranslation(translationResult);
      }

      if (willAddToHistory) {
        setFinalTranscriptHistory((prev) => [
          ...prev,
          {
            uuid: Date.now(),
            finalTranscriptProxy: finalTranscriptProxy,
            translation: translationResult,
            fromLang: fromLang,
            toLang: toLang,
            audioData: "",
          },
        ]);
      }
    }
    if (finalTranscriptProxy) {
      appendToHistory();
    }
  }, [finalTranscriptProxy, fromLang, toLang, willAddToHistory]);

  useEffect(() => {
    scoreIncreaseRef.current();
  }, [finalTranscriptProxy]);

  useEffect(() => {
    if (!speakEnable) {
      console.log({ speakEnable });
      return;
    }
    const speakTranslation = (text: string, lang: string) => {
      console.log("speak: __/" + text + "\\__");
      flaggedFreeSpeak(text, lang);
    };

    if (translation) {
      speakTranslation(translation, toLang);
    }
  }, [translation, toLang, flaggedFreeSpeak, speakEnable]);

  useEffect(() => {
    console.log("init listening");
    setTimeout(handleStartListening);
  }, [handleStartListening]);

  /*
    force recycle of current transcript 
    */
  useEffect(() => {
    const delay = delayBetweenWords; // Delay in milliseconds
    let timerId: NodeJS.Timeout | null = null;

    if (transcript && transcript !== "-") {
      timerId = setTimeout(() => {
        console.log({ finish: transcript });
        setFinalTranscriptProxy(transcript);
        resetTranscript();
      }, delay);
    }

    return () => {
      timerId && clearTimeout(timerId);
    };
  }, [transcript, resetTranscript, delayBetweenWords]);

  useEffect(() => {
    if (listening || isSpeaking) {
      console.log({ listening, isSpeaking });
      return;
    }

    const timoutId = setTimeout(() => {
      console.info("start listen after delay");
      handleStartListening();
    }, maxDelayForNotListening);

    return () => {
      clearTimeout(timoutId);
    };
  }, [handleStartListening, listening, isSpeaking, maxDelayForNotListening]);

  useRecognitionEvents(SpeechRecognition, onEndHandler);

  //-----end useEffect
  if (!browserSupportsSpeechRecognition) {
    return (
      <span style={{ color: "red" }}>
        Browser doesn't support speech recognition.
      </span>
    );
  }

  return (
    <div
      className="container"
      style={{
        background: isSpeaking
          ? "darkblue"
          : listening
            ? "darkgreen"
            : "darkgrey",
      }}
    >
      <div style={{ background: "grey" }}>
        <div className="centeredContainer" onClick={() => resetScore()}>
          <h1>score: {score}</h1>
        </div>
        <Accordion title={"instructions"}>
          <Instructions instructions={instructions}></Instructions>
        </Accordion>
        <button
          type="button"
          onClick={() => setIsModeConversation((prev) => !prev)}
          style={{ background: isModeConversation ? "blue" : "green" }}
        >
          {isModeConversation ? "conversation" : "single talker"}
        </button>
        <button
          type="button"
          onClick={() => switchBetweenToAndFromLangs()}
          style={{ background: isModeConversation ? "blue" : "green" }}
        ></button>

        {/* show main text source/translation */}
        {/* <ShowTranscriptAndTranslation
          fromLang={fromLang}
          transcript={transcript}
          finalTranscriptProxy={finalTranscriptProxy}
          toLang={toLang}
          isSpeaking={isSpeaking}
          translation={translation}
          speakEnable={speakEnable}
          setSpeakEnable={setSpeakEnable}
          switchBetweenToAndFromLangs={switchBetweenToAndFromLangs}
        /> */}
        <ShowTranscriptAndTranslationWithAnswer
          fromLang={fromLang}
          transcript={transcript}
          finalTranscriptProxy={finalTranscriptProxy}
          answer={answer}

          toLang={toLang}
          isSpeaking={isSpeaking}
          translation={translation}
          speakEnable={speakEnable}
          setSpeakEnable={setSpeakEnable}
          switchBetweenToAndFromLangs={switchBetweenToAndFromLangs}
        />
        <Accordion title={"languages"} style={{ height: "60px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "row", width: "100%" }}
            >
              <TranslationBox
                isActiveTalking={!!transcript}
                setText={setFinalTranscriptProxy}
                setLanguage={setFromLang}
                language={fromLang}
                text={transcript || finalTranscriptProxy}
                onfreeSpeakOnly={flaggedFreeSpeak}
                availableVoices={availableVoices}
                selectedVoice={selectedFromVoice}
                setSelectedVoice={setSelectedFromVoice}
              />

              <TranslationBox
                isActiveTalking={isSpeaking}
                setText={setTranslation}
                setLanguage={setToLang}
                language={toLang}
                text={translation || ""}
                onfreeSpeakOnly={onfreeSpeakOnly}
                availableVoices={availableVoices}
                selectedVoice={selectedToVoice}
                setSelectedVoice={setSelectedToVoice}
              />
            </div>
          </div>
        </Accordion>
        <Debug isModeDebug={isModeDebug}>
          <button
            type="button"
            onClick={() => setShowTranslationHistory((prev) => !prev)}
            style={{ background: showTranslationHistory ? "blue" : "green" }}
          >
            showTranslationHistory {showTranslationHistory ? "yes" : "no"}
          </button>

          <RangeInput
            value={maxDelayForNotListening}
            setValue={setMaxDelayForNotListening}
            title="maxDelayForNotListening"
          />

          <p style={{ color: "blue" }}>listening: {listening ? "on" : "off"}</p>
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
            <label htmlFor="clearTranscriptOnListen">
              clearTranscriptOnListen:
            </label>
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

          {!listening ? (
            <button
              style={{ backgroundColor: "green", color: "white" }}
              disabled={listening}
              onClick={handleStartListening}
            >
              Start
            </button>
          ) : (
            <button
              style={{ backgroundColor: "red", color: "white" }}
              disabled={!listening}
              onClick={SpeechRecognition.stopListening}
            >
              Stop
            </button>
          )}

          <button
            style={{ backgroundColor: "orange", color: "white" }}
            onClick={resetTranscript}
          >
            Reset
          </button>
          <CheckBoxSwitch
            isModeValue={isContinuous}
            setIsModeValue={setIsContinuous}
            title="continuous"
          />

          <Logger messages={logMessages} setMessages={setLogMessages} />
          <RangeInput
            value={delayBetweenWords}
            setValue={setdelayBetweenWords}
            title="delayBetweenWords"
          />
        </Debug>
      </div>

      {finalTranscriptHistory.length ? (
        <Accordion title="history">
          <TranscriptHistory
            finalTranscriptHistory={finalTranscriptHistory}
            onfreeSpeakOnly={onfreeSpeakOnly}
            onEndPlayback={
              () => {
                console.log("implement startListenAndRecord");
              }
              //startListenAndRecord
            }
            onBeforePlayback={() => {
              console.log("implement stopListenAndRecord");
            }}
          />
        </Accordion>
      ) : null}
      <Accordion title="show README">
        <Todo url="https://raw.githubusercontent.com/ofer-shaham/voice-recognition-chrome/main/README.md" />
      </Accordion>
      <BugComponent />

      <CheckBoxSwitch
        isModeValue={isModeDebug}
        setIsModeValue={setIsModeDebug}
        title="Debug"
      />


      {/* <SpeakMultiple verifiedResponse={verifiedResponse} verificationExceptions={verificationExceptions} sentences={sentences} /> */}
    </div>
  );
};

export default React.memo(MobileVer);
