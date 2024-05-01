import { useState, useEffect, RefObject } from 'react';
import { FsDocument, FsDocumentElement } from '../types/FsDocument';
 
function useFullscreen<T extends FsDocumentElement>(elementRef: RefObject<T>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (elementRef.current) {
        if (elementRef.current.requestFullscreen) {
          elementRef.current.requestFullscreen();
        } else if (elementRef.current.mozRequestFullScreen) {
          elementRef.current.mozRequestFullScreen();
        } else if (elementRef.current.webkitRequestFullscreen) {
          elementRef.current.webkitRequestFullscreen();
        } else if (elementRef.current.msRequestFullscreen) {
          elementRef.current.msRequestFullscreen();
        }
      }
    } else {
      const fsDoc = document as FsDocument;
      if (fsDoc.exitFullscreen) {
        fsDoc.exitFullscreen();
      } else if (fsDoc.mozCancelFullScreen) {
        fsDoc.mozCancelFullScreen();
      } else if (fsDoc.webkitExitFullscreen) {
        fsDoc.webkitExitFullscreen();
      } else if (fsDoc.msExitFullscreen) {
        fsDoc.msExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fsDoc = document as FsDocument;

      setIsFullscreen(
        !!(
          fsDoc.fullscreenElement ||
          fsDoc.mozFullScreenElement ||
          fsDoc.webkitFullscreenElement ||
          fsDoc.msFullscreenElement
        )
      );
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  return [isFullscreen, toggleFullscreen] as const;
}

export default useFullscreen;