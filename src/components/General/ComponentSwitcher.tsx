import React, { useState } from 'react';


// import { isMobile } from './services/isMobile';
import MobileVer from '../MobileVer';
import PcVer from '../PcVer';
import { isMobile } from '../../services/isMobile';



const ComponentSwitcher: React.FC = () => {
  const [showMobile, setShowMobile] = useState<boolean>(isMobile);

  const toggleComponent = () => {
    setShowMobile(!showMobile);
  };

  return (
    <div>
      <button onClick={toggleComponent}>Toggle Component</button>
      {!showMobile ? <MobileVer /> : <PcVer />}
    </div>
  );
};

export default React.memo(ComponentSwitcher);