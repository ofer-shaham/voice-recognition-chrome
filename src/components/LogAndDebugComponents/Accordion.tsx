import React, { useState, useEffect } from 'react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties; // Add style prop
  timeout?: number; // Add timeout prop
}
const MIN_DELAY = 2000
const Accordion: React.FC<AccordionProps> = ({ title, children, timeout }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    let hideTimeout: NodeJS.Timeout | null = null;

    if (timeout) {
      hideTimeout = setTimeout(() => {
        setIsExpanded(false);
      }, MIN_DELAY + timeout * 1000);
    }

    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, [timeout, isExpanded]);

  const toggleAccordion = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div style={{ width: '100%' }}>
      <button style={{ width: '100%' }} onClick={toggleAccordion}>
        {title}
      </button>
      {isExpanded && <div>{children}</div>}
    </div>
  );
};

export default React.memo(Accordion);