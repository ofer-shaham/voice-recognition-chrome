import React, { useEffect, useState } from 'react';
// import logo from './logo.svg';
import './App.css';
import { Dictaphone } from './components/Dictaphone';
import { VoiceRecorder } from './components/VoiceRecorder';
import { Logger } from './Logger';


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
      // await freeSpeech(instructions.welcome.test)
    } catch (error) {
      console.error('Error getting user media:', error);
      alert('Error getting user media')
    }
  };
  return (
    <div>
      {stream ? (
        <div className="App">
          {/* <VoiceRecorder stream={stream} /> */}
          <Dictaphone stream={stream} />

        </div>
      ) : (
        <button onClick={handleMicAccess}>Grant microphone access</button>

      )}
      <Logger errors={errors} setErrors={setErrors} />

    </div>

  )
}
export default App;
