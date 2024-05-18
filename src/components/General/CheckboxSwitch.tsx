import React from 'react';

interface Props {
    isModeValue: boolean;
    title: string;
    setIsModeValue: React.Dispatch<React.SetStateAction<boolean>>;
}


const CheckBoxSwitch: React.FC<Props> = ({ isModeValue, setIsModeValue, title }) => {
    return (
        <div id="configuration">
            <label>
                <input
                    type="checkbox"
                    checked={isModeValue}
                    onChange={() => setIsModeValue(!isModeValue)}
                />
             {title}
            </label>
        </div>
    );
};

export default CheckBoxSwitch;
