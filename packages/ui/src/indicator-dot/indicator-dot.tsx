import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

export const indicatorDotVariants = cva('size-1.5 shrink-0 rounded-full', {
  variants: {
    variant: {
      default: 'bg-primary',
      destructive: 'bg-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export type IndicatorDotProps = ComponentProps<'span'> & VariantProps<typeof indicatorDotVariants>;

/** A small dot for flagging that something needs attention. Composes into
 *  any leading/trailing slot, e.g. `Button`'s `trailing` prop. Size via `className`. */
export function IndicatorDot({ className, variant, ...props }: IndicatorDotProps) {
  return (
    <span
      data-slot="indicator-dot"
      className={cn(indicatorDotVariants({ variant }), className)}
      {...props}
    />
  );
}
