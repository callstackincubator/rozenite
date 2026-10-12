import type { ReactNode } from 'react';
import { cn, ScrollArea } from '@rozenite/ui';

export type TabContentProps = {
  children: ReactNode;
  className?: string;
};

/** The scrolling, padded body shared by every side panel tab. */
export const TabContent = ({ children, className }: TabContentProps) => (
  <ScrollArea className="h-full w-full">
    <div className={cn('flex flex-col gap-5 p-4', className)}>{children}</div>
  </ScrollArea>
);
