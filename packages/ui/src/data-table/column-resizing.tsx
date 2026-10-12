import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import type {
  ColumnSizingState,
  Header,
  OnChangeFn,
  RowData,
  TableOptions,
} from '@tanstack/react-table';
import { cn } from '../utils/cn';

export type ColumnResizingOptions = {
  /** Width of a column that has no explicit `size`, in px. Maps to TanStack's `defaultColumn.size`. */
  defaultSize?: number;
  /** Narrowest a column can be dragged to, in px. */
  minSize?: number;
  /** Widest a column can be dragged to, in px. */
  maxSize?: number;
  /** Controlled column widths, keyed by column id. Pair with `onSizingChange` to persist them. */
  sizing?: ColumnSizingState;
  onSizingChange?: OnChangeFn<ColumnSizingState>;
  /**
   * `'onChange'` resizes the column live while dragging; `'onEnd'` waits for the pointer to be
   * released.
   * @default 'onChange'
   */
  mode?: 'onChange' | 'onEnd';
};

/** Opt in with `true` for the defaults, or pass options to tune or control the widths. */
export type ColumnResizingProp = boolean | ColumnResizingOptions;

/** How far an arrow key moves a column edge, in px. */
const KEYBOARD_RESIZE_STEP = 16;

type ColumnResizingTableOptions<TData extends RowData> = Pick<
  TableOptions<TData>,
  'enableColumnResizing' | 'columnResizeMode' | 'defaultColumn' | 'onColumnSizingChange'
>;

/**
 * Resolves the `columnResizing` prop into the TanStack options and the widths to feed back
 * into `state.columnSizing`. Callers that don't opt in get `enabled: false` and untouched
 * table options.
 */
export function useColumnResizing<TData extends RowData>(prop: ColumnResizingProp | undefined) {
  const [uncontrolledSizing, setUncontrolledSizing] = useState<ColumnSizingState>({});
  const enabled = Boolean(prop);
  const options: ColumnResizingOptions = typeof prop === 'object' && prop !== null ? prop : {};

  const tableOptions: Partial<ColumnResizingTableOptions<TData>> = enabled
    ? {
        enableColumnResizing: true,
        columnResizeMode: options.mode ?? 'onChange',
        defaultColumn: {
          ...(options.defaultSize !== undefined && { size: options.defaultSize }),
          ...(options.minSize !== undefined && { minSize: options.minSize }),
          ...(options.maxSize !== undefined && { maxSize: options.maxSize }),
        },
        onColumnSizingChange: options.onSizingChange ?? setUncontrolledSizing,
      }
    : {};

  return {
    enabled,
    columnSizing: options.sizing ?? uncontrolledSizing,
    tableOptions,
  };
}

/**
 * Layout for a table whose columns are resized: fixed layout, exactly as wide as its columns.
 * Widths on the header cells drive the layout, so the table has to say how wide it is.
 */
export function resizableTableStyle(totalSize: number) {
  return { tableLayout: 'fixed', width: totalSize, minWidth: totalSize } as const;
}

/** Classes that keep a body cell inside its column once columns have a fixed width. */
export const resizableCellClassName = 'overflow-hidden text-ellipsis whitespace-nowrap';

const getColumnName = <TData extends RowData>(header: Header<TData, unknown>) =>
  typeof header.column.columnDef.header === 'string'
    ? header.column.columnDef.header
    : header.column.id;

/**
 * The drag handle on the right edge of a column header. A focusable vertical separator:
 * drag it, press the arrow keys, or double-click to reset the column.
 */
export function ColumnResizeHandle<TData extends RowData>({
  header,
}: {
  header: Header<TData, unknown>;
}) {
  const { column } = header;

  if (!column.getCanResize()) {
    return null;
  }

  const startResizing = header.getResizeHandler();
  const isResizing = column.getIsResizing();
  const { minSize = 0, maxSize = Number.MAX_SAFE_INTEGER } = column.columnDef;

  const resizeBy = (delta: number) => {
    const size = Math.min(maxSize, Math.max(minSize, column.getSize() + delta));

    header.getContext().table.setColumnSizing((current) => ({ ...current, [column.id]: size }));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      resizeBy(event.key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP);
    }
  };

  return (
    <div
      data-slot="column-resize-handle"
      data-resizing={isResizing || undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${getColumnName(header)} column`}
      aria-valuenow={column.getSize()}
      aria-valuemin={minSize}
      aria-valuemax={maxSize === Number.MAX_SAFE_INTEGER ? undefined : maxSize}
      tabIndex={0}
      className={cn(
        'group/resize absolute inset-y-0 right-0 z-10 flex w-2 cursor-col-resize touch-none select-none justify-center',
        'outline-none',
      )}
      onMouseDown={startResizing}
      onTouchStart={startResizing}
      onClick={(event: MouseEvent) => event.stopPropagation()}
      onDoubleClick={() => column.resetSize()}
      onKeyDown={handleKeyDown}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-full w-px bg-border transition-colors duration-[120ms]',
          'group-hover/resize:bg-border-strong group-focus-visible/resize:bg-primary',
          'group-data-[resizing]/resize:bg-primary',
        )}
      />
    </div>
  );
}
