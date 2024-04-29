import React, { useState } from 'react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ title, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleAccordion = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div>
      <button onClick={toggleAccordion}>{title}</button>
      {isExpanded && <div>{children}</div>}
    </div>
  );
};

export default Accordion;