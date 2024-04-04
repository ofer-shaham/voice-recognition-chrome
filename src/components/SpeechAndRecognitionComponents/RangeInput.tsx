import React from 'react';

interface RangeInputProps {
    maxDelayBetweenRecognitions: number;
    setMaxDelayBetweenRecognitions: (value: number) => void;
    prevTranscriptTime: [number, number];
}

const RangeInput: React.FC<RangeInputProps> = ({
    maxDelayBetweenRecognitions,
    setMaxDelayBetweenRecognitions,
    prevTranscriptTime,
}) => {
    const MAX_DELAY_BETWEEN_RECOGNITIONS = 10; // Replace with your desired max delay value

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(event.target.value);
        setMaxDelayBetweenRecognitions(value);
    };

    return (
        <div>
            <label htmlFor="rangeInput">maxDelayBetweenRecognitions:</label>
            <input
                type="range"
                id="rangeInput"
                name="maxDelayBetweenRecognitions"
                min="0"
                max={MAX_DELAY_BETWEEN_RECOGNITIONS * 2}
                step="0.1"
                value={maxDelayBetweenRecognitions}
                onChange={handleChange}
            />
            <br />
            <p>{maxDelayBetweenRecognitions}</p>
            <p>{Math.floor((prevTranscriptTime[1] - prevTranscriptTime[0]) / 1000)}</p>
        </div>
    );
};

export default RangeInput;