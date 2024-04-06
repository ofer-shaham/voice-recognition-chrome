import React from 'react';
import { MAX_DELAY_BETWEEN_WORDS } from '../../consts/config';

interface RangeInputProps {
    delayBetweenWords: number;
    setdelayBetweenWords: (value: number) => void;
 }

const RangeInput: React.FC<RangeInputProps> = ({
    delayBetweenWords,
    setdelayBetweenWords,
    // prevTranscriptTime,
}) => {

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(event.target.value);
        setdelayBetweenWords(value);
    };

    return (
        <div>
            <label htmlFor="rangeInput">delayBetweenWords:</label>
            <input
                type="range"
                id="rangeInput"
                name="delayBetweenWords"
                min="0"
                max={MAX_DELAY_BETWEEN_WORDS}
                step="1"
                value={delayBetweenWords}
                onChange={handleChange}
            />
            <br />
            <p>{delayBetweenWords}</p>
            {/* <p>{Math.floor((prevTranscriptTime[1] - prevTranscriptTime[0]) / 1000)}</p> */}
        </div>
    );
};

export default RangeInput;