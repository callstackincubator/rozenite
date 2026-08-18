import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';
import { surfaceTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

/** Shape and size only — color comes from `surfaceTone`, crossed with `tone`. */
export const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap',
  {
    variants: {
      size: {
        sm: 'px-1.5 py-0 text-xs',
        md: 'px-2 py-0.5 text-xs',
        lg: 'px-2.5 py-1 text-sm',
      } as const satisfies Record<Size, string>,
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type BadgeProps = ComponentProps<'span'> &
  Pick<VariantProps<typeof badgeVariants>, 'size'> &
  Pick<VariantProps<typeof surfaceTone>, 'variant'> & {
    /** @default 'primary' */
    tone?: Tone;
    /** Replace the rendered element, e.g. `render={<a href="..." />}`. */
    render?: useRender.RenderProp;
  };

/** A compact status label for categorizing or highlighting content. */
export function Badge({
  className,
  tone = 'primary',
  variant,
  size,
  render,
  ref,
  ...props
}: BadgeProps) {
  return useRender({
    render: render ?? <span />,
    ref,
    props: {
      'data-slot': 'badge',
      className: cn(badgeVariants({ size }), surfaceTone({ tone, variant }), className),
      ...props,
    },
  });
}
