import React, { useEffect, useState } from 'react';
import Todo from './components/LogAndDebugComponents/mdPresenter';
import './styles/App.css';
import { Dictaphone } from './components/SpeechAndRecognitionComponents/Dictaphone';

function App() {
  const [microphoneAccess, setMicrophoneAccess] = useState(false);
  const [showMainComponent, setShowMainComponent] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleClick = () => {
    setShowMainComponent(!showMainComponent);
  };

  const checkMicrophoneAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicrophoneAccess(true);
    } catch (error) {
      console.log('Microphone access denied:', error);
    }
  };

  useEffect(() => {
    checkMicrophoneAccess();
  }, []);

  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     setShowDictaphone(true);
  //   }, 10000);
  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <>
      {microphoneAccess ? (
        <div className="App">

          {countdown > 0 ? (
            <div className="countdown">
              <h2>Countdown: {countdown}</h2>
              <Todo url="https://raw.githubusercontent.com/ofer-shaham/voice-recognition-chrome/main/README.md" />
              <button className="main-button" onClick={handleClick}>
                {showMainComponent ? 'Hide Main Component' : 'Show Main Component'}
              </button>
            </div>

          ) : null}

          {showMainComponent && <div className="main-component">
            {<Dictaphone />}
          </div>}



        </div>
      ) : (
        <button onClick={checkMicrophoneAccess}>Grant microphone access</button>
      )}
    </>
  );
}

export default App;