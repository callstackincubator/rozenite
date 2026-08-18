import type { ComponentProps, ElementType } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

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

export type TextProps = ComponentProps<'span'> & VariantProps<typeof textVariants>;

/** Typography for everything that isn't a page or section heading. */
export function Text({ className, variant, ...props }: TextProps) {
  return <span data-slot="text" className={cn(textVariants({ variant }), className)} {...props} />;
}

const headingLevelTag = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
} as const satisfies Record<number, ElementType>;

export type HeadingProps = ComponentProps<'h1'> & {
  /** Which heading element to render.
   * @default 2 */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
};

/** A semantic page or section heading, styled with the `title` type scale. */
export function Heading({ level = 2, className, ...props }: HeadingProps) {
  const Tag = headingLevelTag[level];

  return (
    <Tag
      data-slot="heading"
      className={cn(textVariants({ variant: 'title' }), className)}
      {...props}
    />
  );
}
