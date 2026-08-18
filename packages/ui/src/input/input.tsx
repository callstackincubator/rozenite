import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';
import type { Size } from '../tokens/size';

export type InputProps = Omit<ComponentProps<'input'>, 'size'> & {
  /** @default 'md' */
  size?: Size;
};

/** A single-line text input styled for the Rozenite UI. */
export function Input({ className, type = 'text', size = 'md', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(fieldSurface({ size }), 'min-w-0', className)}
      {...props}
    />
  );
}
