import type { ReactNode } from 'react';
import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { cn } from '../utils/cn';

export type ScrollAreaProps = ScrollAreaPrimitive.Root.Props & {
  children?: ReactNode;
  viewportClassName?: string;
};

function ScrollAreaRoot({
  className,
  viewportClassName,
  children,
  ...props
}: ScrollAreaProps) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn('h-full w-full', viewportClassName)}
      >
        <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
      </ScrollAreaPrimitive.Viewport>
      <ScrollAreaBar orientation="vertical" />
      <ScrollAreaBar orientation="horizontal" />
      <ScrollAreaPrimitive.Corner data-slot="scroll-area-corner" />
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollAreaBar({
  orientation,
}: {
  orientation: 'vertical' | 'horizontal';
}) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none p-0.5 transition-colors select-none',
        orientation === 'vertical' && 'h-full w-2.5',
        orientation === 'horizontal' && 'h-2.5 w-full flex-col',
      )}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-border hover:bg-muted-foreground"
      />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export const ScrollArea = ScrollAreaRoot;
