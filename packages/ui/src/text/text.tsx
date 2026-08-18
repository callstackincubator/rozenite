import { createElement, type ComponentProps, type ElementType } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import { textTone } from '../tokens/tone-variants';
import type { Tone } from '../tokens/tone';

export const textVariants = cva('text-foreground', {
  variants: {
    variant: {
      title: 'text-base font-semibold',
      heading: 'text-sm font-semibold',
      body: 'text-sm font-normal',
      caption: 'text-xs text-muted-foreground',
      code: 'font-mono text-xs',
      numeric: 'font-mono text-xs tabular-nums',
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

export type TextProps = ComponentProps<'span'> &
  VariantProps<typeof textVariants> & {
    /** Overrides the variant's default color. */
    tone?: Tone;
    /** Replace the rendered element, e.g. `render={<label />}`. */
    render?: useRender.RenderProp;
  };

/** Typography for everything that isn't a page or section heading. */
export function Text({ className, variant, tone, render, ref, ...props }: TextProps) {
  return useRender({
    render: render ?? <span />,
    ref,
    props: {
      'data-slot': 'text',
      className: cn(textVariants({ variant }), tone && textTone({ tone }), className),
      ...props,
    },
  });
}

const headingLevelTag = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<number, ElementType>;

const headingLevelClass = {
  1: 'text-lg font-bold',
  2: 'text-base font-semibold',
  3: 'text-sm font-semibold',
  4: 'text-sm font-medium',
  5: 'text-xs font-semibold',
  6: 'text-xs font-medium',
} as const satisfies Record<1 | 2 | 3 | 4 | 5 | 6, string>;

export type HeadingProps = ComponentProps<'h1'> & {
  /** Which heading element to render, and its type size.
   * @default 2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Overrides the default foreground color. */
  tone?: Tone;
  /** Replace the rendered element, keeping the `level` type size. */
  render?: useRender.RenderProp;
};

/** A semantic page or section heading. `level` controls both the rendered
 *  element (`h1`-`h6`) and its type size. */
export function Heading({ level = 2, tone, className, render, ref, ...props }: HeadingProps) {
  return useRender({
    render: render ?? createElement(headingLevelTag[level]),
    ref,
    props: {
      'data-slot': 'heading',
      className: cn(
        textVariants({ variant: 'title' }),
        headingLevelClass[level],
        tone && textTone({ tone }),
        className,
      ),
      ...props,
    },
  });
}
