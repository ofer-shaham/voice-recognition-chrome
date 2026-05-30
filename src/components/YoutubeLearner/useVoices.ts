import { useState, useEffect, useMemo } from 'react';
import { loadVoices } from '../../utils/freeSpeak';
import { LANG_OPTIONS } from './constants';

export interface LangOption {
  code: string;
  label: string;
}

export function useVoices() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    loadVoices().then(setVoices);
    const handler = () => loadVoices().then(setVoices);
    speechSynthesis.addEventListener('voiceschanged', handler);
    return () => speechSynthesis.removeEventListener('voiceschanged', handler);
  }, []);

  // Merged language list: LANG_OPTIONS + any extra languages found in browser voices
  const langOptions = useMemo<LangOption[]>(() => {
    const seen = new Set(LANG_OPTIONS.map(l => l.code));
    const extras: LangOption[] = [];
    for (const v of voices) {
      const code = v.lang.replace('_', '-');
      const base = code.split('-')[0];
      if (!seen.has(code) && !seen.has(base)) {
        seen.add(code);
        // Use the Intl API to get a human-readable language name when available
        let label = code;
        try { label = new Intl.DisplayNames(['en'], { type: 'language' }).of(base) ?? code; } catch { /* ignore */ }
        extras.push({ code, label: `${label} (${code})` });
      }
    }
    return [
      ...LANG_OPTIONS,
      ...extras.sort((a, b) => a.label.localeCompare(b.label)),
    ];
  }, [voices]);

  // Return voices filtered to those that match a given language code
  const voicesForLang = (lang: string): SpeechSynthesisVoice[] => {
    const base = lang.split(/[-_]/)[0].toLowerCase();
    return voices.filter(v => v.lang.split(/[-_]/)[0].toLowerCase() === base);
  };

  return { voices, langOptions, voicesForLang };
}
