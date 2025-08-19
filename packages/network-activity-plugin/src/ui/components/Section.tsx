import React, { useState } from 'react';
import { cn } from '../utils/cn';

export type SectionProps = {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
};

export const Section = ({
  title,
  children,
  collapsible = true,
}: SectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isChildrenVisible = !collapsible || !isCollapsed;

  const handleCollapseSection = () => {
    setIsCollapsed((prevState) => !prevState);
  };

  const headerClassName = `flex items-center w-full text-left text-sm text-gray-300 mb-2 ${
    collapsible ? 'hover:text-white' : 'cursor-default'
  }`;

  return (
    <div>
      <button
        onClick={collapsible ? handleCollapseSection : undefined}
        className={headerClassName}
        tabIndex={collapsible ? 0 : -1}
      >
        {collapsible && (
          <span className={cn('mr-2', { 'rotate-90': !isCollapsed })}>▶</span>
        )}
        <span className="font-medium">{title}</span>
      </button>
      {isChildrenVisible && children}
    </div>
  );
};
