import React, { Dispatch, SetStateAction } from 'react';

type TranslationProps = {
  language: string;
  text: string;
  onFreeSpeech: (text: string, lang: string) => void;
  setLanguage: Dispatch<SetStateAction<string>>;
};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onFreeSpeech, setLanguage }) => {
  return (
    <div className="translation-container">

      <input type="text" defaultValue={language} onChange={(ev) => { setLanguage(ev.target.value) }} />

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