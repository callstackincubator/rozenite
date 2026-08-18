import type { ComponentProps } from 'react';
import { useRender } from '@base-ui/react/use-render';
import { cn } from '../utils/cn';
import {
  flexAlignClass,
  flexGapClass,
  flexJustifyClass,
  type FlexAlign,
  type FlexGap,
  type FlexJustify,
} from '../utils/flex';

export type RowProps = ComponentProps<'div'> & {
  gap?: FlexGap;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: boolean;
  /** `min-w-0 flex-1` — take the remaining width without overflowing a flex row. */
  fill?: boolean;
  /** `overflow-auto`, typically paired with `fill`. */
  scroll?: boolean;
  /** Replace the rendered element, e.g. `render={<ul />}`. */
  render?: useRender.RenderProp;
};

/** A horizontal flex layout primitive. */
export function Row({
  className,
  gap,
  align,
  justify,
  wrap,
  fill,
  scroll,
  tabIndex,
  render,
  ref,
  ...props
}: RowProps) {
  return useRender({
    render: render ?? <div />,
    ref,
    props: {
      'data-slot': 'row',
      // Keyboard-focusable when scrollable, so it's reachable without a mouse.
      tabIndex: scroll ? (tabIndex ?? 0) : tabIndex,
      className: cn(
        'flex flex-row',
        gap !== undefined && flexGapClass[gap],
        align && flexAlignClass[align],
        justify && flexJustifyClass[justify],
        wrap && 'flex-wrap',
        fill && 'min-w-0 flex-1',
        scroll && 'overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      ),
      ...props,
    },
  });
}
