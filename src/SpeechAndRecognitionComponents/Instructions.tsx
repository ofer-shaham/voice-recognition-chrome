import React from 'react';
import { freeSpeak } from '../utils/freeSpeak';

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
        <div id="instructions" style={{
            background: 'grey', display: 'flex', flexDirection: 'column',
        }}>
            <h1>How to use:</h1>
            {Object.keys(instructions).map((key) => (
                <div key={key} style={{
                    background: 'grey', display: 'flex', flexDirection: 'row', width:'100%'
                }}>
                    <button style={{ flex: '1' , width: '100%'}} onClick={() => freeSpeak(instructions[key].test)}>
                        {instructions[key].explain}
                    </button>
                </div>
            ))}
            
        </div>
    );
};

export default Instructions;