import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import type { Tone } from '../tokens/tone';
import type { Size } from '../tokens/size';

const indicatorDotTone = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
} as const satisfies Record<Tone, string>;

export const indicatorDotVariants = cva('shrink-0 rounded-full', {
  variants: {
    tone: indicatorDotTone,
    size: {
      sm: 'size-1',
      md: 'size-1.5',
      lg: 'size-2',
    } as const satisfies Record<Size, string>,
  },
  defaultVariants: {
    tone: 'primary',
    size: 'md',
  },
});

export type IndicatorDotProps = ComponentProps<'span'> & VariantProps<typeof indicatorDotVariants>;

/** A small dot for flagging that something needs attention. Composes into
 *  any leading/trailing slot, e.g. `Button`'s `trailing` prop. */
export function IndicatorDot({ className, tone, size, ...props }: IndicatorDotProps) {
  return (
    <span
      data-slot="indicator-dot"
      className={cn(indicatorDotVariants({ tone, size }), className)}
      {...props}
    />
  );
}
