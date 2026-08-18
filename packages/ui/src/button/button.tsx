import type { ComponentProps, ReactNode } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import { surfaceTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

/** Shape and size only — color comes from `surfaceTone`, crossed with `tone`. */
export const buttonVariants = cva(
  cn(
    'relative inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors',
    'outline-none focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ),
  {
    variants: {
      size: {
        sm: 'h-6 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 [&_svg]:size-4',
        lg: 'h-10 px-4 [&_svg]:size-5',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  Pick<VariantProps<typeof buttonVariants>, 'size'> &
  Pick<VariantProps<typeof surfaceTone>, 'variant'> & {
    /** @default 'primary' */
    tone?: Tone;
    /** Rendered after `children`, e.g. an `IndicatorDot` flagging an update. */
    trailing?: ReactNode;
    /** Replace the rendered element, e.g. `render={<a href="..." />}` for a link styled as a button. */
    render?: useRender.RenderProp;
  };

/** A styled button for actions that change state or submit work. Renders a
 *  `<button>` by default; pass `render` to render as something else, e.g. an anchor. */
export function Button({
  className,
  tone = 'primary',
  variant,
  size,
  type = 'button',
  trailing,
  children,
  render,
  ref,
  ...props
}: ButtonProps) {
  return useRender({
    render: render ?? <button type={type} />,
    ref,
    props: {
      'data-slot': 'button',
      className: cn(
        buttonVariants({ size }),
        surfaceTone({ tone, variant, interactive: true }),
        className,
      ),
      children: (
        <>
          {children}
          {trailing}
        </>
      ),
      ...props,
    },
  });
}
