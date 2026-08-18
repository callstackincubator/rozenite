import type { ComponentProps } from 'react';
import { cn } from '../utils/cn';
import {
  flexAlignClass,
  flexGapClass,
  flexJustifyClass,
  type FlexAlign,
  type FlexGap,
  type FlexJustify,
} from '../utils/flex';

export type ColumnProps = ComponentProps<'div'> & {
  gap?: FlexGap;
  align?: FlexAlign;
  justify?: FlexJustify;
  wrap?: boolean;
  /** `min-h-0 flex-1` — take the remaining height without overflowing a flex column. */
  fill?: boolean;
  /** `overflow-auto`, typically paired with `fill`. */
  scroll?: boolean;
};

/** A vertical flex layout primitive. */
export function Column({
  className,
  gap,
  align,
  justify,
  wrap,
  fill,
  scroll,
  tabIndex,
  ...props
}: ColumnProps) {
  return (
    <div
      data-slot="column"
      // Keyboard-focusable when scrollable, so it's reachable without a mouse.
      tabIndex={scroll ? (tabIndex ?? 0) : tabIndex}
      className={cn(
        'flex flex-col',
        gap !== undefined && flexGapClass[gap],
        align && flexAlignClass[align],
        justify && flexJustifyClass[justify],
        wrap && 'flex-wrap',
        fill && 'min-h-0 flex-1',
        scroll && 'overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
      {...props}
    />
  );
}
