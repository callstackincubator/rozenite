import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { fieldSurface } from '../utils/control-surfaces';

export type TextareaProps = ComponentProps<'textarea'>;

/** A multiline text input styled for the Rozenite UI. */
export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldSurface(), 'min-h-28 min-w-0 resize-y px-3 py-2', className)}
      {...props}
    />
  );
}
