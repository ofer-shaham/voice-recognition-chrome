import React, { useState, useEffect } from 'react';
import MobileVer from '../MobileVer';
import PcVer from '../PcVer';
import { isMobile } from '../../services/isMobile';
import { MODE_DEV } from '../../consts/config';
import { useSearchParams } from 'react-router-dom';

const ComponentSwitcher: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showMobile, setShowMobile] = useState<boolean>(isMobile);

  const toggleComponent = () => {
    const updatedShowMobile = !showMobile;
    setShowMobile(updatedShowMobile);
    setSearchParams({ ...searchParams, showMobile: updatedShowMobile.toString() });
  };

  useEffect(() => {
    const searchShowMobile = searchParams.get('showMobile');
    if (searchShowMobile !== null) {
      setShowMobile(searchShowMobile === 'true');
    } else {
      setSearchParams({ ...searchParams, showMobile: showMobile.toString() });

    }
  }, [searchParams, setSearchParams, showMobile]);

  return (
    <div>
      {MODE_DEV && (
        <button onClick={toggleComponent}>
          Toggle Component: {!showMobile ? 'Mobile' : 'Pc'}
        </button>
      )}
      {showMobile ? <MobileVer /> : <PcVer />}
    </div>
  );
};

export default React.memo(ComponentSwitcher);