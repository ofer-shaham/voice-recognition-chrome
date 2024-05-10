import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { initialFromLang, initialToLang } from '../consts/config';

const useLanguageSelection = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFromVoice, setSelectedFromVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [selectedToVoice, setSelectedToVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [fromLang, setFromLang] = useState<string>('');
  const [toLang, setToLang] = useState<string>('');

  useEffect(() => {
    const searchToLang = searchParams.get('to-lang') || initialToLang;
    const searchFromLang = searchParams.get('from-lang') || initialFromLang;

    if (searchToLang) {
      console.log(searchToLang);
      setToLang(searchToLang);
    }
    if (searchFromLang) {
      console.log(searchFromLang);
      setFromLang(searchFromLang);
    }
  }, [searchParams]);

  useEffect(() => {
    const updatedParams = new URLSearchParams(searchParams);

    if (fromLang) {
      updatedParams.set('from-lang', fromLang);
    }
    if (toLang) {
      updatedParams.set('to-lang', toLang);
    }

    setSearchParams(updatedParams);
  }, [toLang, fromLang, setSearchParams, searchParams]);

  return {
    selectedFromVoice,
    setSelectedFromVoice,
    selectedToVoice,
    setSelectedToVoice,
    fromLang,
    setFromLang,
    toLang,
    setToLang
  };
};

export default useLanguageSelection;