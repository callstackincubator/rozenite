import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '../utils/cn';
import { monoLabel } from '../utils/mono-label';

export type KbdProps = ComponentProps<'kbd'> & {
  /** Replace the rendered element. */
  render?: useRender.RenderProp;
};

/** A styled keyboard key or shortcut hint. */
export function Kbd({ className, render, ref, ...props }: KbdProps) {
  return useRender({
    render: render ?? <kbd />,
    ref,
    props: {
      'data-slot': 'kbd',
      className: cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-input bg-muted px-1 text-[10px] text-muted-foreground',
        monoLabel,
        className,
      ),
      ...props,
    },
  });
}
