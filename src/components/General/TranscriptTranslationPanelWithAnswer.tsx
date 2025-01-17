import React, { Dispatch, SetStateAction } from "react";
import FullScreenMode from "./FullScreenWrapper";
import isRtl from "../../utils/isRtl";
import ButtonSwitch from "./ButtonSwitch";
import LanguageSwitcher from "../LanguageSwitcher";
import "../../styles/mobileVer.css";

interface ShowTranscriptAndTranslationWithAnswerProps {
    fromLang: string;
    transcript: string;
    finalTranscriptProxy: string;
    answer: string;
    toLang: string;
    isSpeaking: boolean;
    translation: string;
    speakEnable: boolean;
    setSpeakEnable: Dispatch<SetStateAction<boolean>>;
    switchBetweenToAndFromLangs: () => void;
}

const ShowTranscriptAndTranslation: React.FC<
    ShowTranscriptAndTranslationWithAnswerProps
> = ({
    fromLang,
    transcript,
    finalTranscriptProxy,
    answer,
    toLang,
    isSpeaking,
    translation,
    speakEnable,
    setSpeakEnable,
    switchBetweenToAndFromLangs,
}) => {
        const fromLangClassName = isRtl(fromLang) ? "is-rtl" : "";
        const toLangClassName = isRtl(toLang) ? "is-rtl" : "";
        return (
            <FullScreenMode>
                <LanguageSwitcher
                    fromLang={fromLang}
                    toLang={toLang}
                    switchLanguages={switchBetweenToAndFromLangs}
                />
                <div className="buttons-container">
                    <ButtonSwitch
                        isModeValue={speakEnable}
                        setIsModeValue={setSpeakEnable}
                        title="speak translation"
                    />
                    <div className="button-container">
                        <button className={`button`}>{fromLang}</button>
                    </div>
                    <div>
                        {transcript ? (
                            <p className={`transcript ${fromLangClassName}`}>{transcript}</p>
                        ) : (
                            <p className={`final-transcript ${fromLangClassName}`}>
                                {finalTranscriptProxy}
                            </p>
                        )}
                    </div>
                    <div className="button-container">
                        <div>
                            <button className={`button`}>{toLang}</button>
                        </div>
                        <div>
                            <p
                                className={`answer ${toLangClassName} ${isSpeaking ? "is-speaking" : ""
                                    }`}
                            >
                                {answer}
                            </p>
                        </div>
                    </div>
                    <div className="button-container">
                        <div>
                            <button className={`button`}>{toLang}</button>
                        </div>
                        <div>
                            <p
                                className={`translation ${toLangClassName} ${isSpeaking ? "is-speaking" : ""
                                    }`}
                            >
                                {translation}
                            </p>
                        </div>
                    </div>
                </div>
            </FullScreenMode>
        );
    };

export default ShowTranscriptAndTranslation;
