import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';

export type InputProps = ComponentProps<'input'>;

/** A single-line text input styled for the Rozenite UI. */
export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldSurface(), 'h-8 min-w-0 px-3', className)}
      {...props}
    />
  );
}
