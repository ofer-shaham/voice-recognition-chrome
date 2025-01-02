import React, { useEffect, useState } from 'react';

interface Sentence {
    lang_code: string;
    text: string;
}

interface SpeakMultipleProps {
    sentences: Sentence[];
    verifiedResponse: any; // Replace 'any' with the appropriate type if known
    verificationExceptions: any; // Replace 'any' with the appropriate type if known
}

const SpeakMultiple: React.FC<SpeakMultipleProps> = ({ sentences }) => {
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [isPaused, setIsPaused] = useState<boolean>(false);
    const [utterance, setUtterance] = useState<SpeechSynthesisUtterance | null>(null);

    const freeSpeak = (text: string, toLang: string = 'en-US'): Promise<void> => {
        return new Promise((resolve) => {
            const newUtterance = new SpeechSynthesisUtterance(text);
            newUtterance.lang = toLang;

            newUtterance.onend = () => {
                resolve();
                setCurrentIndex((prevIndex) => (prevIndex + 1 < sentences.length ? prevIndex + 1 : prevIndex));
            };

            speechSynthesis.speak(newUtterance);
            setUtterance(newUtterance);
        });
    };

    useEffect(() => {
        const speakSentences = async () => {
            for (let index = currentIndex; index < sentences.length; index++) {
                if (isPaused) {
                    break;
                }
                await freeSpeak(sentences[index].text, sentences[index].lang_code);
            }
        };

        speakSentences();
    }, [currentIndex, isPaused, sentences]);

    const handlePauseResume = () => {
        if (isPaused) {
            speechSynthesis.resume();
        } else {
            speechSynthesis.pause();
        }
        setIsPaused(!isPaused);
    };
    debugger;
    return (
        <div style={{ background: 'red' }}>
            <div>
                {sentences.map((sentence, index) => (
                    <div
                        key={index}
                        style={{
                            backgroundColor: index === currentIndex ? 'yellow' : 'transparent',
                            padding: '5px',
                            borderRadius: '4px',
                        }}
                    >
                        {sentence.text} ({sentence.lang_code})
                    </div>
                ))}
            </div>
            <button onClick={handlePauseResume}>
                {isPaused ? 'Resume' : 'Pause'}
            </button>
        </div>
    );
};

export default SpeakMultiple;