import React, { ReactNode } from 'react';
import '../../styles/Debug.css'
type DebugProps = {
    children: ReactNode;
    isModeDebug: boolean;
};

const Debug: React.FC<DebugProps> = ({ isModeDebug, children }) => {
    if (!isModeDebug) return <></>
    return <div className="debug">{children}</div>;
};

export default Debug;