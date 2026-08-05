import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';

export type InputProps = ComponentProps<'input'>;

export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs transition-colors',
        'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        'placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
