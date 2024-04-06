import React, { useEffect, useState } from 'react';
import Todo from './components/LogAndDebugComponents/mdPresenter';

import './styles/App.css';
import { Dictaphone } from './components/SpeechAndRecognitionComponents/Dictaphone';
import { Logger } from './components/LogAndDebugComponents/Logger';


function App() {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [errors, setErrors] = useState<any[]>([]);


  useEffect(() => {
    console.log('init app');
    setErrors([])
  }, [])


  const handleMicAccess = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      // await freeSpeak(instructions.welcome.test)
    } catch (error) {
      console.error('Error getting user media:', error);
      alert('Error getting user media')
    }
  };
  return (
    <div>


      {stream ? (
        <div className="App">

          <Dictaphone stream={stream} />
          <Todo url="plans.md" />
        </div>
      ) : (
        <button onClick={handleMicAccess}>Grant microphone access</button>

      )}
      <Logger errors={errors} setErrors={setErrors} />

    </div>

  )
}
export default App;
