import React, { Dispatch, ReactElement, SetStateAction, useEffect } from 'react';
import '../../styles/TranslationBox.css';
import { useDebouncedCallback } from 'use-debounce';
import { DEBOUNCE_TEXT_DELAY } from '../../consts/config';
import VoicesDropdownSelect from './voicesDropdownSelector';

type TranslationProps = {
  language: string;
  text: string;
  onfreeSpeakOnly: (text: string, lang: string) => void;
  setLanguage: Dispatch<SetStateAction<string>>;
  setText: Dispatch<SetStateAction<string>>;
  children?: ReactElement;
  isActiveTalking: boolean;
  availableVoices: SpeechSynthesisVoice[];
  selectedVoice: SpeechSynthesisVoice | null;
  setSelectedVoice: Dispatch<SetStateAction<SpeechSynthesisVoice | null>>;
};

const TranslationBox: React.FC<TranslationProps> = ({ language, text, onfreeSpeakOnly, setLanguage, setText, isActiveTalking, availableVoices, selectedVoice, setSelectedVoice }) => {


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

  useEffect(()=>{setLanguage(selectedVoice?.lang || '')},[selectedVoice, setLanguage])

  return (
    <div className="translation-container" style={{ width: '100%' }}>
      <div style={{ minHeight: '19px' }}>
        <VoicesDropdownSelect voices={availableVoices} language={language} selectedVoice={selectedVoice}
          setSelectedVoice={setSelectedVoice} />
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

export default React.memo(TranslationBox);