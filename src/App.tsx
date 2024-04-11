import React, { useEffect, useState } from 'react';
import Todo from './components/LogAndDebugComponents/mdPresenter';

import './styles/App.css';
import { Dictaphone } from './components/SpeechAndRecognitionComponents/Dictaphone';
import { Logger } from './components/LogAndDebugComponents/Logger';


function App() {
  const [logMessages, setLogMessages] = useState<any[]>([]);


  useEffect(() => {
    console.log('init app');
    setLogMessages([])
  }, [])


  const handleMicAccess = async () => {
    try {

      // await freeSpeak(instructions.welcome.test)
    } catch (error) {
      console.error('Error getting user media:', error);
      alert('Error getting user media')
    }
  };
  return (
    <div>


      {true ? (
        <div className="App">

          {/* <VoiceRecorder stream={stream} /> */}

          <Dictaphone />
          <Todo url="plans.md" />
        </div>
      ) : (
        <button onClick={handleMicAccess}>Grant microphone access</button>

      )}
      <Logger messages={logMessages} setMessages={setLogMessages} />

    </div>

  )
}
export default App;
