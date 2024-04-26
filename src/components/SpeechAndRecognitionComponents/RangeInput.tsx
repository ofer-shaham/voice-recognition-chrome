import React from 'react';
import { MAX_DELAY_BETWEEN_WORDS } from '../../consts/config';

interface RangeInputProps {
  value: number;
  setValue: (value: number) => void;
  title: string;
}

const RangeInput: React.FC<RangeInputProps> = ({
  value,
  setValue,
  title
  // prevTranscriptTime,
}) => {

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setValue(value);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
      <div style={{ marginRight: '10px' }}>
        <label htmlFor="rangeInput">{title}:</label>
        <input
          type="range"
          id="rangeInput"
          name="value"
          min="0"
          max={MAX_DELAY_BETWEEN_WORDS}
          step="1"
          value={value}
          onChange={handleChange}
        />
      </div>
      <p style={{ marginLeft: '10px' }}>{value}</p>
      {/* <p>{Math.floor((prevTranscriptTime[1] - prevTranscriptTime[0]) / 1000)}</p> */}
    </div>
  );
};

export default RangeInput;