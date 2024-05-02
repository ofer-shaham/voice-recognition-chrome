import React, { Dispatch, ReactElement, SetStateAction } from 'react';
import '../../styles/TranslationBox.css';
import { useDebouncedCallback } from 'use-debounce';
import { DEBOUNCE_TEXT_DELAY } from '../../consts/config';

type TranslationProps = {
  language: string;
  text: string;
  onfreeSpeakOnly: (text: string, lang: string) => void;
  setLanguage: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
  children?: ReactElement;
  isActiveTalking: boolean;

};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onfreeSpeakOnly, setLanguage, setText, children, isActiveTalking }) => {

  const changeLanguage = useDebouncedCallback(
    (value) => {
      setLanguage(value);
    },
    DEBOUNCE_TEXT_DELAY
  );

  const changeText = useDebouncedCallback(
    (value) => {
      console.log(new Date().getSeconds())
      setText(value);
    },
    DEBOUNCE_TEXT_DELAY
  );


  return (
    <div className="translation-container" style={{ width: '100%' }}>
      <div style={{ minHeight: '19px' }}>
        {children}
      </div>

      <input type="text" defaultValue={language}
        onChange={(e) => changeLanguage(e.target.value)}

        style={{ width: '100%' }} />

      <div className="translation-row">
        <input type="text" defaultValue={text} onChange={(ev) => { changeText(ev.target.value) }} style={{ width: '100%', color: isActiveTalking ? 'red' : 'white' }}
        />
      </div>

      <div style={{ width: '100%' }}>
        <button onClick={() => onfreeSpeakOnly(text, language)}>speak</button>
      </div>

    </div>
  );
};

export default TranslationBox;