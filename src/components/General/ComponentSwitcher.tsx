import React, { useState } from 'react';


// import { isMobile } from './services/isMobile';
import MobileVer from '../MobileVer';
import PcVer from '../PcVer';
import { isMobile } from '../../services/isMobile';
import { MODE_DEV } from '../../consts/config';



const ComponentSwitcher: React.FC = () => {
  const [showMobile, setShowMobile] = useState<boolean>(isMobile);

  const toggleComponent = () => {
    setShowMobile(!showMobile);
  };

  return (
    <div>
      <button onClick={toggleComponent}>Toggle Component: {!showMobile ? 'Mobile':'Pc'}</button>
      {showMobile || MODE_DEV ? <MobileVer /> : <PcVer />}
    </div>
  );
};

export default React.memo(ComponentSwitcher);