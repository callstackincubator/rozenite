import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type {
  ColumnSizingInfoState,
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
  /**
   * Controlled column widths, keyed by column id. Always pair it with `onSizingChange`: a
   * controlled table only changes width when its owner feeds the new widths back, so `sizing`
   * on its own leaves the handles unable to resize anything.
   */
  sizing?: ColumnSizingState;
  /** Called with every width change, while dragging as well as on release. */
  onSizingChange?: OnChangeFn<ColumnSizingState>;
};

/** Opt in with `true` for the defaults, or pass options to tune or control the widths. */
export type ColumnResizingProp = boolean | ColumnResizingOptions;

/** How far an arrow key moves a column edge, in px. */
const KEYBOARD_RESIZE_STEP = 16;

type ColumnResizingTableOptions<TData extends RowData> = Pick<
  TableOptions<TData>,
  | 'enableColumnResizing'
  | 'columnResizeMode'
  | 'defaultColumn'
  | 'onColumnSizingChange'
  | 'onColumnSizingInfoChange'
>;

const INITIAL_SIZING_INFO: ColumnSizingInfoState = {
  startOffset: null,
  startSize: null,
  deltaOffset: null,
  deltaPercentage: null,
  isResizingColumn: false,
  columnSizingStart: [],
};

/**
 * Resolves the `columnResizing` prop into the TanStack options and the widths to feed back
 * into `state.columnSizing`. Callers that don't opt in get `enabled: false` and untouched
 * table options.
 */
export function useColumnResizing<TData extends RowData>(prop: ColumnResizingProp | undefined) {
  const [uncontrolledSizing, setUncontrolledSizing] = useState<ColumnSizingState>({});
  const [sizingInfo, setSizingInfo] = useState<ColumnSizingInfoState>(INITIAL_SIZING_INFO);
  const sizingInfoRef = useRef(sizingInfo);
  sizingInfoRef.current = sizingInfo;
  const enabled = Boolean(prop);
  const options: ColumnResizingOptions = typeof prop === 'object' && prop !== null ? prop : {};

  const sizingWithoutHandler = enabled && options.sizing !== undefined && !options.onSizingChange;

  useEffect(() => {
    if (
      sizingWithoutHandler &&
      typeof process !== 'undefined' &&
      process.env.NODE_ENV !== 'production'
    ) {
      console.warn(
        '[@rozenite/ui] `columnResizing.sizing` was passed without `onSizingChange`, so the table ' +
          'cannot resize: the widths are controlled and nothing updates them. Pass ' +
          '`onSizingChange` too, or drop `sizing` to let the table keep its own widths.',
      );
    }
  }, [sizingWithoutHandler]);

  const tableOptions: Partial<ColumnResizingTableOptions<TData>> = enabled
    ? {
        enableColumnResizing: true,
        columnResizeMode: 'onChange',
        defaultColumn: {
          ...(options.defaultSize !== undefined && { size: options.defaultSize }),
          ...(options.minSize !== undefined && { minSize: options.minSize }),
          ...(options.maxSize !== undefined && { maxSize: options.maxSize }),
        },
        onColumnSizingChange: options.onSizingChange ?? setUncontrolledSizing,
        // TanStack's drag handler fills a shared object from inside this updater and reads it
        // from the sizing updater queued right after. React runs queued updaters lazily, and in
        // the order their state hooks were declared, so left to React the sizing updater can run
        // first and every move would land one step late (the last one never). Evaluating this
        // one eagerly, against a ref, keeps the two in order.
        onColumnSizingInfoChange: (updater) => {
          sizingInfoRef.current =
            typeof updater === 'function' ? updater(sizingInfoRef.current) : updater;
          setSizingInfo(sizingInfoRef.current);
        },
      }
    : {};

  return {
    enabled,
    /** The `state` entries the table needs while resizing is enabled. */
    state: {
      columnSizing: options.sizing ?? uncontrolledSizing,
      columnSizingInfo: sizingInfo,
    },
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
          'h-full w-px bg-border transition-[width,background-color] duration-[120ms]',
          'group-hover/resize:bg-border-strong group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-primary',
          'group-data-[resizing]/resize:w-0.5 group-data-[resizing]/resize:bg-primary',
        )}
      />
    </div>
  );
}
