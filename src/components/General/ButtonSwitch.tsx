import React from 'react';

interface Props {
    isModeValue: boolean;
    title: string;
    setIsModeValue: React.Dispatch<React.SetStateAction<boolean>>;
}

const ButtonSwitch: React.FC<Props> = ({ isModeValue, setIsModeValue, title }) => {
    return (
        <div id="configuration">

            <button
                style={{ backgroundColor: 'grey', color: 'white', borderColor: isModeValue ? 'green' : 'red' }}

                onClick={() => { setIsModeValue(prev => !prev) }}
            >
                {title} {isModeValue ? 'is on' : 'is off'}
            </button>


        </div>
    );
};

export default ButtonSwitch;
