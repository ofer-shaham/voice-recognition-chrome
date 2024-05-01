import { useEffect, useState } from 'react';
import Todo from './LogAndDebugComponents/mdPresenter';
import '../styles/App.css';
import React from 'react';

import { errorCode } from '../consts/config';
import ComponentSwitcher from './General/ComponentSwitcher'
// eslint-disable-next-line no-restricted-globals
const hostname = location.hostname

const Intro: React.FC = () => {
  const [microphoneAccess, setMicrophoneAccess] = useState(false);
  const [userClicked, setUserClicked] = useState(false);
  const [countdown, setCountdown] = useState(hostname === 'localhost' ? 3 : 0);

  useEffect(() => {
    if (!userClicked) return
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown, userClicked]);

  const handleClick = () => {
    setUserClicked(true);
  };

  const checkMicrophoneAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneAccess(true);
    } catch (error: Error | any) {
      console.error('Microphone access denied:', error);
      if (error.toString().includes('device not found')) {
        alert(`${errorCode.microphone_not_found}:\n${errorCode.microphone_not_found_details}`);
      } else if (error.toString().includes('Permission denied')) {
        alert(`${errorCode.microphone_no_permission}:\n${errorCode.microphone_no_permission_details}`);
      }
    }
  };

  useEffect(() => {
    checkMicrophoneAccess();
  }, []);

  return (
    <>
      {microphoneAccess ? (
        <div className="App">
          {countdown > 0 ? (
            <div className="countdown">
              <Todo url="https://raw.githubusercontent.com/ofer-shaham/voice-recognition-chrome/main/README.md" />
              <button className="main-button" onClick={handleClick}>
                {!userClicked ? 'please click to continue' : 'Loading ' + countdown}
              </button>
            </div>

          ) : <div className="main-component">
            <ComponentSwitcher />
          </div>}
        </div>
      ) : (
        <button onClick={checkMicrophoneAccess}>Grant microphone access</button>
      )}
    </>
  );
}

export default React.memo(Intro);