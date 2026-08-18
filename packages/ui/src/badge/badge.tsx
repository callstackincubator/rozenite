import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';

export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        secondary: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
      },
      size: {
        sm: 'px-1.5 py-0 text-[10px]',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-sm',
      } as const satisfies Record<Size, string>,
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & {
    /** Replace the rendered element, e.g. `render={<a href="..." />}`. */
    render?: useRender.RenderProp;
  };

/** A compact status label for categorizing or highlighting content. */
export function Badge({ className, variant, size, render, ref, ...props }: BadgeProps) {
  return useRender({
    render: render ?? <span />,
    ref,
    props: {
      'data-slot': 'badge',
      className: cn(badgeVariants({ variant, size }), className),
      ...props,
    },
  });
}
