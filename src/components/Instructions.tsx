import React from 'react';
import { freeSpeech } from '../utils/freeSpeak';

interface InstructionsProps {
    instructions: {
        [key: string]: {
            test: string;
            explain: string;
        };
    };
}

const Instructions: React.FC<InstructionsProps> = ({ instructions }) => {
    return (
        <div id="instructions" style={{ background: 'grey' }}>
            <h1>How to use:</h1>
            {Object.keys(instructions).map((key) => (
                <button key={key} onClick={() => freeSpeech(instructions[key].test)}>
                    {instructions[key].explain}
                </button>
            ))}
        </div>
    );
};

export default Instructions;