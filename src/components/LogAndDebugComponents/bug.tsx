
import React from 'react';

const BugComponent: React.FC = () => {
    const handleBugClick = () => {
        window.location.href = 'https://github.com/ofer-shaham/voice-recognition-chrome/issues';
    };

    return (
        <div
            id="bug-component"
            onClick={handleBugClick}
            style={{
                backgroundColor: '#f44336',
                color: '#fff',
                padding: '10px',
                borderRadius: '5px',
                cursor: 'pointer',
                textAlign: 'center',
            }}
        >
            <p style={{ margin: 0 }}>report a bug</p>
        </div>
    );
};

export default BugComponent;