import React from 'react';

type TranslationProps = {
  language: string;
  text: string;
  onFreeSpeech: (text: string, lang: string) => void;
};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onFreeSpeech }) => {
  return (
    <div className="translation-container">

      <input type="text" value={language} readOnly />

      <div className="translation-row">
        <input type="text" value={text} readOnly />
      </div>

      <div>
        <button onClick={() => onFreeSpeech(text, language)}>speak</button>
      </div>
    </div>
  );
};

export default TranslationBox;