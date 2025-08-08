import React, { useState } from 'react';
import { cn } from '../utils/cn';

export type SectionProps = {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  childClassName?: string;
};

export const Section = ({
  title,
  children,
  collapsible = true,
  childClassName,
}: SectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleExpanded = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div>
      <button
        onClick={toggleExpanded}
        className={`flex items-center w-full text-left text-sm text-gray-300 mb-2 ${
          collapsible ? 'hover:text-white' : 'cursor-default'
        }`}
      >
        {collapsible && (
          <span className={cn('mr-2', { 'rotate-90': !isCollapsed })}>▶</span>
        )}
        <span className="font-medium">{title}</span>
      </button>
      {(!collapsible || !isCollapsed) && (
        <div className={childClassName}>{children}</div>
      )}
    </div>
  );
};
