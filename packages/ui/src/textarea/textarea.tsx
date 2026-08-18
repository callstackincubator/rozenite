import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import { textareaSurface } from '../utils/control-surfaces';
import type { Size } from '../tokens/size';

export type TextareaProps = ComponentProps<'textarea'> & {
  /** @default 'md' */
  size?: Size;
};

/** A multiline text input styled for the Rozenite UI. */
export function Textarea({ className, size = 'md', ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(textareaSurface({ size }), 'min-w-0 resize-y', className)}
      {...props}
    />
  );
}
