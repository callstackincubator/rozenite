import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';

export type TextareaProps = ComponentProps<'textarea'>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-28 w-full min-w-0 resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs transition-colors',
        'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
        'placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
