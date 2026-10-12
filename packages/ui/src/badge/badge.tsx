import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import type { Size } from '../tokens/size';
import { surfaceTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';
import { monoLabel } from '../utils/mono-label';

/** Shape and size only — color comes from `surfaceTone`, crossed with `tone`. */
export const badgeVariants = /* @__PURE__ */ cva(
  /* @__PURE__ */ cn(
    'inline-flex w-fit shrink-0 items-center justify-center rounded-sm whitespace-nowrap tabular-nums',
    monoLabel,
  ),
  {
    variants: {
      size: {
        sm: 'h-4 px-1 text-[10px]',
        md: 'h-5 px-1.5 text-[11px]',
        lg: 'h-6 px-2 text-xs',
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
