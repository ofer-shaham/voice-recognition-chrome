import React from 'react';

interface Props {
    isModeDebug: boolean;
    setIsModeDebug: React.Dispatch<React.SetStateAction<boolean>>;
}

const DebugModeSwitch: React.FC<Props> = ({ isModeDebug, setIsModeDebug }) => {
    return (
        <div id="configuration">
            <label>
                Debug mode:
                <input
                    type="checkbox"
                    checked={isModeDebug}
                    onChange={() => setIsModeDebug(!isModeDebug)}
                />
            </label>
        </div>
    );
};

export default DebugModeSwitch;