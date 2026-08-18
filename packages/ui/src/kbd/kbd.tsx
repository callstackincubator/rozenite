import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';

export type KbdProps = ComponentProps<'kbd'>;

/** A styled keyboard key or shortcut hint. */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted px-1 font-mono text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
