import React, { useEffect } from 'react';

// export interface  SpeechSynthesisVoice as   Voice;
// {
//   name: string;
//   lang: string;
//   default: boolean;
// }

const VoicesDropdownSelect = ({ voices, selectedVoice, setSelectedVoice, toLang, setToLang, isMobile }: {
    voices: SpeechSynthesisVoice[],
    toLang: string, setToLang: React.Dispatch<React.SetStateAction<string>>
    , selectedVoice: SpeechSynthesisVoice | null, setSelectedVoice: React.Dispatch<React.SetStateAction<SpeechSynthesisVoice | null>>
    , isMobile: boolean

    
}) => {


    useEffect(() => {
        console.info('change language to ', toLang)
        if (!voices?.length) return;
        const voice = voices.find(r => r.lang === (isMobile ? toLang.replace('-', '_') : toLang))
        voice && setSelectedVoice(voice)


    }, [voices, toLang, setSelectedVoice, isMobile])

    const handleVoiceSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedLang = event.target.value;
        const selectedVoice = voices.find((voice) => voice.lang === selectedLang);
        if (selectedVoice) {

            setSelectedVoice(selectedVoice);
            setToLang(selectedLang);
        }
    };
    return (
        <div className='select-voice'>
            <select id="voiceSelect"
                value={selectedVoice?.lang}
                onChange={handleVoiceSelect}
            >
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