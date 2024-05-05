import React, { ReactNode, RefObject, useRef } from 'react';
import useFullscreen from '../../hooks/useFullscreen';
import { FsDocumentElement } from '../../types/FsDocument';


type FullScreenWrapperProps = {
    children: ReactNode
  };
  
const FullScreenWrapper: React.FC<FullScreenWrapperProps> = ({ children }) => {
    const elementRef = useRef(null);
    const [isFullscreen, toggleFullscreen] = useFullscreen(elementRef as RefObject<FsDocumentElement>);

    return (
        <div ref={elementRef}>
            <button style={{height:'35px'}} onClick={toggleFullscreen}>
                {isFullscreen ? 'Exit Fullscreen' : 'Go Fullscreen'}
            </button>
            {children}
        </div>
    );
}

export default FullScreenWrapper;   