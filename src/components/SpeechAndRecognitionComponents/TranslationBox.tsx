import React, { Dispatch, ReactElement, SetStateAction, useEffect } from 'react';
import '../../styles/TranslationBox.css';

type TranslationProps = {
  language: string;
  text: string;
  onfreeSpeak: (text: string, lang: string) => void;
  setLanguage: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
  children?: ReactElement;
};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onfreeSpeak, setLanguage, setText, children }) => {
  // Update the language when the prop changes from the parent component
  useEffect(() => {
    setLanguage(language);
  }, [language, setLanguage]);

  const handleLanguageChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    // Update the language manually
    setLanguage(ev.target.value);
  };

  return (
    <div className="translation-container" style={{ width: '100%' }}>
      <div style={{ minHeight: '19px' }}>
        {children}
      </div>

      <input type="text" value={language} onChange={handleLanguageChange} style={{ width: '100%' }} />

      <div className="translation-row">
        <input type="text" value={text} onChange={(ev) => { setText(ev.target.value) }} style={{ width: '100%' }} />
      </div>

      <div style={{ width: '100%' }}>
        <button onClick={() => onfreeSpeak(text, language)}>speak</button>
      </div>

    </div>
  );
};

export default TranslationBox;