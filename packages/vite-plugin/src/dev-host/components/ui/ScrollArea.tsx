import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { cn } from '../../utils.js';

type ScrollAreaProps = ComponentPropsWithoutRef<'div'> & {
  children: ReactNode;
};

export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(({ className, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('rz-scroll-area', className)} {...props}>
      <div className="rz-scroll-viewport">{children}</div>
    </div>
  );
});

ScrollArea.displayName = 'ScrollArea';
