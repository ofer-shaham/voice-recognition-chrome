import React, { useEffect, useState } from 'react';
import Todo from './components/LogAndDebugComponents/mdPresenter';

import './styles/App.css';
import { Dictaphone } from './components/SpeechAndRecognitionComponents/Dictaphone';



function App() {
  const [microphoneAccess, setMicrophoneAccess] = useState(false);
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

  return (
    <>
      {microphoneAccess ? (
        <div className="App"> 
          <Todo url="https://raw.githubusercontent.com/ofer-shaham/voice-recognition-chrome/main/README.md" />
          <Dictaphone />
        </div>
      ) : (
        <button onClick={checkMicrophoneAccess}>Grant microphone access</button>
      )}
    </>
  )
}

export default App;
