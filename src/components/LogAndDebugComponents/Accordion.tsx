import React, { useState } from 'react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties; // Add style prop
  activeStyle?: React.CSSProperties; // Add activeStyle prop
}

const Accordion: React.FC<AccordionProps> = ({ title, children, style, activeStyle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleAccordion = () => {
    setIsExpanded(!isExpanded);
  };

  const buttonStyle = {
    width: '100%',
    ...(isExpanded ? activeStyle : style), // Conditionally merge styles
  };

  return (
    <div style={{ width: '100%' }}>
      <button style={buttonStyle} onClick={toggleAccordion}>
        {title}
      </button>
      {isExpanded && <div>{children}</div>}
    </div>
  );
};

export default React.memo(Accordion);