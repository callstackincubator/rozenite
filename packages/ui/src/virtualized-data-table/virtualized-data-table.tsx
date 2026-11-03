import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type Row,
  type SortingState,
} from '@tanstack/react-table';
import { TableVirtuoso, type ItemProps, type TableComponents } from 'react-virtuoso';
import {
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cn } from '../utils/cn';
import { SortIcon } from '../utils/sort-icon';
import { monoLabel } from '../utils/mono-label';
import {
  ColumnResizeHandle,
  ResizableColgroup,
  resizableCellClassName,
  resizableTableStyle,
  useColumnResizing,
  type ColumnResizingProp,
} from '../data-table/column-resizing';

const DEFAULT_TABLE_CLASSNAME = 'w-full border-collapse text-sm';
const DEFAULT_SCROLL_CLASSNAME = 'h-full w-full overflow-auto';
const DEFAULT_STYLE: CSSProperties = { height: 400 };

export type VirtualizedDataTableProps<TData> = {
  ariaLabel: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  /** Stable row id. Defaults to the TanStack row index. */
  getRowId?: (item: TData, index: number) => string;
  getRowTextValue?: (item: TData, index: number) => string;
  onRowClick?: (item: TData) => void;
  onStartReached?: (index: number) => void;
  onEndReached?: (index: number) => void;
  /** Controlled sorting state. Omit it to use internal sorting. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
  /** Lets callers delegate sorting to a data source instead of sorting rows locally. */
  manualSorting?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  /** Overrides the default centered empty or loading rendering. */
  renderEmptyState?: () => ReactNode;
  /** Applied to the semantic table element. */
  className?: string;
  /** Applied to Virtuoso's scroll container. */
  scrollClassName?: string;
  style?: CSSProperties;
  /**
   * Opt in to draggable column borders. Columns start at 150px unless `defaultSize` or a
   * column's own `size` says otherwise. The table is as wide as its columns or its container,
   * whichever is larger. A column opts out with `enableResizing: false`.
   */
  columnResizing?: ColumnResizingProp;
};

type VirtualizedTableContext<TData> = {
  ariaLabel: string;
  columnCount: number;
  emptyMessage: string;
  getRowTextValue?: (item: TData, index: number) => string;
  isLoading: boolean;
  /** Set when columns are resizable: the table is laid out at exactly this width. */
  resizableTotalSize: number | null;
  onRowClick?: (item: TData) => void;
  renderEmptyState?: () => ReactNode;
  tableClassName: string;
};

type TableComponentProps = {
  children?: ReactNode;
  context: VirtualizedTableContext<unknown>;
  style?: CSSProperties;
};

type TableRowComponentProps = ItemProps<unknown> & {
  context: VirtualizedTableContext<unknown>;
};

const VirtualizedTableElement = ({ children, context, style }: TableComponentProps) => (
  <table
    aria-label={context.ariaLabel}
    className={context.tableClassName}
    style={
      context.resizableTotalSize === null
        ? style
        : { ...style, ...resizableTableStyle(context.resizableTotalSize) }
    }
  >
    {context.resizableTotalSize === null ? null : (
      <ResizableColgroup columnCount={context.columnCount} />
    )}
    {children}
  </table>
);

const VirtualizedTableRow = ({ children, context, item, ...props }: TableRowComponentProps) => {
  const row = item as Row<unknown>;
  const isActionable = Boolean(context.onRowClick);

  const activateRow = () => {
    context.onRowClick?.(row.original);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTableRowElement>) => {
    // A control inside the row (a button, a field) owns its own keys.
    if (
      !isActionable ||
      event.target !== event.currentTarget ||
      (event.key !== 'Enter' && event.key !== ' ')
    ) {
      return;
    }

    event.preventDefault();
    activateRow();
  };

  return (
    <tr
      {...props}
      aria-label={context.getRowTextValue?.(row.original, row.index) ?? String(row.id)}
      className={cn(
        'border-b border-border last:border-0 transition-colors duration-[120ms] hover:bg-accent',
        isActionable && 'cursor-pointer',
      )}
      onClick={isActionable ? activateRow : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={isActionable ? 0 : undefined}
    >
      {children}
    </tr>
  );
};

const VirtualizedEmptyState = ({ context }: { context: VirtualizedTableContext<unknown> }) => (
  // Virtuoso renders the placeholder straight inside the `<table>`, so it brings its own `<tbody>`.
  <tbody>
    <tr>
      <td colSpan={context.columnCount}>
        {context.renderEmptyState?.() ?? (
          <div className="flex min-h-56 w-full items-center justify-center px-4 py-10 text-center">
            <span className="text-sm text-muted-foreground">
              {context.isLoading ? 'Loading…' : context.emptyMessage}
            </span>
          </div>
        )}
      </td>
    </tr>
  </tbody>
);

// Virtuoso requires component definitions to remain stable between renders.
// Dynamic behavior travels through its `context` prop instead.
const virtualizedTableComponents: TableComponents<unknown, VirtualizedTableContext<unknown>> = {
  EmptyPlaceholder: VirtualizedEmptyState,
  Table: VirtualizedTableElement,
  TableRow: VirtualizedTableRow,
};

/** A virtualized sortable table for large datasets and incremental loading. */
export const VirtualizedDataTable = <TData,>({
  ariaLabel,
  data,
  columns,
  getRowId,
  getRowTextValue,
  onRowClick,
  onStartReached,
  onEndReached,
  sorting: controlledSorting,
  onSortingChange,
  manualSorting = false,
  loading = false,
  emptyMessage = 'No data.',
  renderEmptyState,
  className,
  scrollClassName,
  style,
  columnResizing,
}: VirtualizedDataTableProps<TData>) => {
  const resizing = useColumnResizing<TData>(columnResizing);
  const [uncontrolledSorting, setUncontrolledSorting] = useState<SortingState>([]);
  const sorting = controlledSorting ?? uncontrolledSorting;

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const nextSorting = typeof updater === 'function' ? updater(sorting) : updater;

      if (controlledSorting === undefined) {
        setUncontrolledSorting(nextSorting);
      }

      onSortingChange?.(nextSorting);
    },
    [controlledSorting, onSortingChange, sorting],
  );

  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    getSortedRowModel: getSortedRowModel(),
    manualSorting,
    onSortingChange: handleSortingChange,
    ...resizing.tableOptions,
    state: { sorting, ...(resizing.enabled && resizing.state) },
  });
  const rows = table.getRowModel().rows;
  // Read per render: `table` is a stable object, so the memo below would never see a resize.
  const resizableTotalSize = resizing.enabled ? table.getTotalSize() : null;
  const context = useMemo<VirtualizedTableContext<TData>>(
    () => ({
      ariaLabel,
      columnCount: table.getVisibleLeafColumns().length,
      emptyMessage,
      getRowTextValue,
      isLoading: loading,
      resizableTotalSize,
      onRowClick,
      renderEmptyState,
      tableClassName: cn(DEFAULT_TABLE_CLASSNAME, className),
    }),
    [
      ariaLabel,
      className,
      emptyMessage,
      getRowTextValue,
      loading,
      onRowClick,
      renderEmptyState,
      resizableTotalSize,
      table,
    ],
  );
  const itemContent = useCallback(
    (_index: number, row: Row<TData>) =>
      row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={cn('px-3 py-1.5 text-foreground', resizing.enabled && resizableCellClassName)}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      )),
    [resizing.enabled],
  );
  const fixedHeaderContent = useCallback(
    () =>
      table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className="border-b border-border bg-card">
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort();
            const sortDirection = header.column.getIsSorted();

            return (
              <th
                key={header.id}
                aria-sort={
                  canSort
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : sortDirection === 'desc'
                        ? 'descending'
                        : 'none'
                    : undefined
                }
                colSpan={header.colSpan}
                className={cn(
                  'h-8 px-3 text-left text-[11px] text-faint',
                  monoLabel,
                  resizing.enabled && 'relative overflow-hidden',
                )}
                style={resizing.enabled ? { width: header.getSize() } : undefined}
                scope="col"
              >
                {header.isPlaceholder ? null : canSort ? (
                  <button
                    className="inline-flex items-center gap-1 uppercase transition-colors duration-[120ms] hover:text-foreground"
                    onClick={header.column.getToggleSortingHandler()}
                    type="button"
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    <span aria-hidden="true">
                      <SortIcon direction={sortDirection} />
                    </span>
                  </button>
                ) : (
                  flexRender(header.column.columnDef.header, header.getContext())
                )}
                {resizing.enabled && <ColumnResizeHandle header={header} />}
              </th>
            );
          })}
        </tr>
      )),
    [resizing.enabled, table],
  );
  const computeItemKey = useCallback((_index: number, row: Row<TData>) => row.id, []);

  return (
    <TableVirtuoso<Row<TData>, VirtualizedTableContext<TData>>
      className={cn(DEFAULT_SCROLL_CLASSNAME, scrollClassName)}
      components={
        virtualizedTableComponents as TableComponents<Row<TData>, VirtualizedTableContext<TData>>
      }
      computeItemKey={computeItemKey}
      context={context}
      data={rows}
      endReached={onEndReached}
      fixedHeaderContent={fixedHeaderContent}
      itemContent={itemContent}
      startReached={onStartReached}
      style={style ? { ...DEFAULT_STYLE, ...style } : DEFAULT_STYLE}
    />
  );
};
