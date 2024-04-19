import React, { useState } from 'react';
import { MODE_STAGE } from './consts/config';
import ExampleKit from './components/stage/minimal-demo';
import AppNormal from './AppNormal';

const App: React.FC = () => {
  const [showExampleKit, setShowExampleKit] = useState<boolean>(MODE_STAGE);

  const toggleComponent = () => {
    setShowExampleKit(!showExampleKit);
  };

  return (
    <div>
      <button onClick={toggleComponent}>Toggle Component</button>
      {showExampleKit ? <ExampleKit /> : <AppNormal />}
    </div>
  );
};

export default App;