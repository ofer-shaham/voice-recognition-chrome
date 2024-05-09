import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom'

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
    setTimeout(() => {
      if (searchToLang) {
        console.log(searchToLang);
        setToLang(searchToLang);
      }
      if (searchFromLang) {
        console.log(searchFromLang);
        setFromLang(searchFromLang);
      }
    });
  }, [searchParams]);

  useEffect(() => {
    if (fromLang && toLang) {
      setSearchParams({ 'from-lang': fromLang, 'to-lang': toLang });
    } else if (fromLang) {
      setSearchParams({ 'from-lang': fromLang });
    } else if (toLang) {
      setSearchParams({ 'to-lang': toLang });
    }
  }, [toLang, fromLang, setSearchParams]);

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