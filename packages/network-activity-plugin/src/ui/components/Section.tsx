import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn, Text } from '@rozenite/ui';

export type SectionProps = {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  action?: React.ReactNode;
};

export const Section = ({ title, children, collapsible = true, action }: SectionProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isChildrenVisible = !collapsible || !isCollapsed;

  const handleCollapseSection = () => {
    setIsCollapsed((prevState) => !prevState);
  };

  return (
    <section className="flex flex-col gap-2">
      <div className="flex min-h-6 items-center gap-2">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={!isCollapsed}
            onClick={handleCollapseSection}
            className="group flex items-center gap-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              className={cn(
                'size-3 shrink-0 text-faint transition-transform duration-[120ms] group-hover:text-foreground',
                !isCollapsed && 'rotate-90',
              )}
            />
            <Text
              variant="label"
              className="transition-colors duration-[120ms] group-hover:text-foreground"
            >
              {title}
            </Text>
          </button>
        ) : (
          <Text variant="label">{title}</Text>
        )}
        {action && <div className="ml-auto flex items-center gap-1">{action}</div>}
      </div>
      {isChildrenVisible && children}
    </section>
  );
};
