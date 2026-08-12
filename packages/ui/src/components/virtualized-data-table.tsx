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
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

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
};

type VirtualizedTableContext<TData> = {
  ariaLabel: string;
  columnCount: number;
  emptyMessage: string;
  getRowTextValue?: (item: TData, index: number) => string;
  isLoading: boolean;
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
  <table aria-label={context.ariaLabel} className={context.tableClassName} style={style}>
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
    if (!isActionable || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    activateRow();
  };

  return (
    <tr
      {...props}
      aria-label={context.getRowTextValue?.(row.original, row.index) ?? String(row.id)}
      className={`border-b border-border last:border-0 transition-colors hover:bg-accent/50 ${
        isActionable ? 'cursor-pointer' : ''
      }`}
      onClick={isActionable ? activateRow : undefined}
      onKeyDown={handleKeyDown}
      tabIndex={isActionable ? 0 : undefined}
    >
      {children}
    </tr>
  );
};

const VirtualizedEmptyState = ({ context }: { context: VirtualizedTableContext<unknown> }) => (
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
  emptyMessage = 'No data available',
  renderEmptyState,
  className = 'w-full border-collapse text-sm',
  scrollClassName = 'h-full w-full overflow-auto',
  style = { height: 400 },
}: VirtualizedDataTableProps<TData>) => {
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
    state: { sorting },
  });
  const rows = table.getRowModel().rows;
  const context = useMemo<VirtualizedTableContext<TData>>(
    () => ({
      ariaLabel,
      columnCount: table.getVisibleLeafColumns().length,
      emptyMessage,
      getRowTextValue,
      isLoading: loading,
      onRowClick,
      renderEmptyState,
      tableClassName: className,
    }),
    [
      ariaLabel,
      className,
      emptyMessage,
      getRowTextValue,
      loading,
      onRowClick,
      renderEmptyState,
      table,
    ],
  );
  const itemContent = useCallback(
    (_index: number, row: Row<TData>) =>
      row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-3 py-1.5 text-foreground">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      )),
    [],
  );
  const fixedHeaderContent = useCallback(
    () =>
      table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className="border-b border-border">
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort();
            const sortDirection = header.column.getIsSorted();

            return (
              <th
                key={header.id}
                aria-sort={
                  sortDirection === 'asc'
                    ? 'ascending'
                    : sortDirection === 'desc'
                      ? 'descending'
                      : 'none'
                }
                colSpan={header.colSpan}
                className="h-8 px-3 text-left text-xs font-medium text-muted-foreground"
                scope="col"
              >
                {header.isPlaceholder ? null : canSort ? (
                  <button
                    className="inline-flex items-center gap-1 hover:text-foreground"
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
              </th>
            );
          })}
        </tr>
      )),
    [table],
  );
  const computeItemKey = useCallback((_index: number, row: Row<TData>) => row.id, []);

  return (
    <TableVirtuoso<Row<TData>, VirtualizedTableContext<TData>>
      className={scrollClassName}
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
      style={style}
    />
  );
};

function SortIcon({ direction }: { direction: false | 'asc' | 'desc' }) {
  if (direction === 'asc') {
    return <ChevronUp className="h-3 w-3" />;
  }

  if (direction === 'desc') {
    return <ChevronDown className="h-3 w-3" />;
  }

  return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/60" />;
}
