import React, { Dispatch, SetStateAction, useEffect } from 'react';

type TranslationProps = {
  language: string;
  text: string;
  onFreeSpeech: (text: string, lang: string) => void;
  setLanguage: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onFreeSpeech, setLanguage, setText }) => {
  // Update the language when the prop changes from the parent component
  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  const handleLanguageChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    // Update the language manually
    setLanguage(ev.target.value);
  };

  return (
    <div className="translation-container">
      <input type="text" value={language} onChange={handleLanguageChange} />

      <div className="translation-row">
        <input type="text" value={text} onChange={(ev) => { setText(ev.target.value) }} />
      </div>

      <div>
        <button onClick={() => onFreeSpeech(text, language)}>speak</button>
      </div>
    </div>
  );
};

export default TranslationBox;