import React from 'react';
import FullScreenMode from './FullScreenWrapper';
import isRtl from '../../utils/isRtl';

interface ShowTranscriptAndTranslationProps {
    fromLang: string;
    transcript: string;
    finalTranscriptProxy: string;
    toLang: string;
    isSpeaking: boolean;
    translation: string;
}

const ShowTranscriptAndTranslation: React.FC<ShowTranscriptAndTranslationProps> = ({
    fromLang,
    transcript,
    finalTranscriptProxy,
    toLang,
    isSpeaking,
    translation
}) => {

    const fromLangClassName = isRtl(fromLang) ? 'is-rtl' : '';
    const toLangClassName = isRtl(toLang) ? 'is-rtl' : '';
    return (
        <FullScreenMode>
            <div className="buttons-container">
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
                        <button className={`button`}>{toLang}</button>
                    </div>
                    <div>
                        <p className={`translation ${toLangClassName} ${isSpeaking ? 'is-speaking' : ''}`}>{translation}</p>
                    </div>
                </div>
            </div>
        </FullScreenMode>
    );
};

export default ShowTranscriptAndTranslation;