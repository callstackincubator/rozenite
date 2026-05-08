import type { PointerEvent as ReactPointerEvent } from 'react';
import { cn } from '../utils.js';

type ResizeHandleProps = {
  className?: string;
  isDragging: boolean;
  isHidden?: boolean;
  orientation: 'horizontal' | 'vertical';
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
};

export const ResizeHandle = ({
  className,
  isDragging,
  isHidden = false,
  orientation,
  label,
  onPointerDown,
}: ResizeHandleProps) => {
  return (
    <div
      className={cn(className)}
      data-dragging={isDragging}
      data-hidden={isHidden}
      aria-hidden={isHidden}
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
    />
  );
};
