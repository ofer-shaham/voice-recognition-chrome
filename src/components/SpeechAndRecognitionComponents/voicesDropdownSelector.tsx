import React, { useEffect } from 'react';
import { isMobile } from '../../services/isMobile';

// export interface  SpeechSynthesisVoice as   Voice;
// {
//   name: string;
//   lang: string;
//   default: boolean;
// }
interface props {
    voices: SpeechSynthesisVoice[];
    language: string;
    selectedVoice: SpeechSynthesisVoice | null;
    setSelectedVoice: React.Dispatch<React.SetStateAction<SpeechSynthesisVoice | null>>;
}

const VoicesDropdownSelect = ({ voices, selectedVoice, setSelectedVoice, language }: props) => {
    const normalizeToLang = (isMobile ? language.replace('-', '_') : language)

    useEffect(() => {
        if (!voices?.length) {
            console.error('no voices')
            return;
        };
        console.info('change language to ', normalizeToLang)
        const voice = voices.find(r => r.lang === normalizeToLang)
        voice ? setSelectedVoice(voice) : console.warn('voice not found on voices list: ', normalizeToLang)
    }, [voices, normalizeToLang, setSelectedVoice])

    const handleVoiceSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedLang = event.target.value;
        const selectedVoice = voices.find((voice) => voice.lang === selectedLang);
        if (selectedVoice) {
            setSelectedVoice(selectedVoice);
        }
    };

    return (
        <div className='select-voice'>
            <select id="voiceSelect"
                value={selectedVoice?.lang}
                onChange={handleVoiceSelect}>
                {voices.map((voice, index) => (
                    <option key={index} value={voice.lang}>
                        {voice.name} ({voice.lang}) {voice.default && '— DEFAULT'}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default VoicesDropdownSelect;