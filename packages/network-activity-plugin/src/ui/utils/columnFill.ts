import type { ColumnSizingState } from '@tanstack/react-table';

/**
 * A resizable table is exactly as wide as its columns, so on a wide pane it would leave a gap
 * on the right. One column, the one that carries the longest text, takes up the slack instead:
 * its width is the larger of what it has been set to and what is left once the others are laid
 * out. The widths people set stay the base, so the column shrinks back to them, never below,
 * before the pane starts to scroll sideways.
 */
export type ColumnFillOptions = {
  /** The column that absorbs leftover width. */
  fillId: string;
  /** The widths set so far; a column missing here has its default. */
  sizing: ColumnSizingState;
  /** Every column's width when nobody has changed it, including the filling column. */
  defaultSizes: Record<string, number>;
  /** The width available to the table, in px. 0 until it is measured. */
  paneWidth: number;
};

/** The widths to lay the table out with: `sizing`, with the filling column stretched to fit. */
export const withColumnFill = ({
  fillId,
  sizing,
  defaultSizes,
  paneWidth,
}: ColumnFillOptions): ColumnSizingState => {
  const sizeOf = (id: string) => sizing[id] ?? defaultSizes[id];
  const othersWidth = Object.keys(defaultSizes)
    .filter((id) => id !== fillId)
    .reduce((total, id) => total + sizeOf(id), 0);

  return { ...sizing, [fillId]: Math.max(sizeOf(fillId), paneWidth - othersWidth) };
};

/**
 * The widths to remember after the table reports a resize of the laid-out widths. The filling
 * column only keeps a width it was given by a person: if its laid-out width is unchanged, what it
 * shows is the stretch, not a choice, and the base it had is kept.
 */
export const keepColumnFillBase = ({
  fillId,
  previous,
  laidOut,
  next,
}: {
  fillId: string;
  /** The widths remembered before the resize. */
  previous: ColumnSizingState;
  /** The widths the table was laid out with, as `withColumnFill` returned them. */
  laidOut: ColumnSizingState;
  /** The widths after the resize. */
  next: ColumnSizingState;
}): ColumnSizingState => {
  const { [fillId]: nextFill, ...others } = next;
  const fill = nextFill !== laidOut[fillId] ? nextFill : previous[fillId];

  return fill === undefined ? others : { ...others, [fillId]: fill };
};
