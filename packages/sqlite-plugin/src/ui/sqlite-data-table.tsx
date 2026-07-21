import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type Header,
  type OnChangeFn,
  type RowData,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { formatNumber } from './utils';
import { SQLITE_ROW_NUMBER_COLUMN_ID } from './sqlite-table-column-order';

const joinClassNames = (
  ...classNames: Array<string | false | null | undefined>
) => classNames.filter(Boolean).join(' ');

const LoadingState = ({ columns }: { columns: number }) => (
  <div aria-live="polite" className="grid gap-3">
    {Array.from({ length: 6 }, (_, rowIndex) => (
      <div
        key={`loading-${rowIndex}`}
        className="grid gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-3"
        style={{
          gridTemplateColumns: `repeat(${Math.max(columns, 3)}, minmax(12rem, 1fr))`,
        }}
      >
        {Array.from({ length: Math.max(columns, 3) }, (_, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className="h-3 animate-pulse rounded-xl bg-surface-secondary"
          />
        ))}
      </div>
    ))}
  </div>
);

type SqliteDataTableProps<TData extends RowData> = {
  tableId: string;
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  columnOrder: string[];
  onColumnOrderChange: OnChangeFn<string[]>;
  emptyTitle: string;
  emptyDescription: string;
  loading?: boolean;
  loadingColumnCount?: number;
  shellClassName?: string;
  scrollContainerClassName?: string;
  tableClassName?: string;
  showRowNumbers?: boolean;
  rowNumberOffset?: number;
  onRowClick?: (row: TData, rowIndex: number) => void;
  getRowAriaLabel?: (row: TData, rowIndex: number) => string;
};

type SortableColumnHeaderProps<TData extends RowData> = {
  header: Header<TData, unknown>;
};

const SortableColumnHeader = <TData extends RowData>({
  header,
}: SortableColumnHeaderProps<TData>) => {
  return (
    <th
      scope="col"
      className={joinClassNames(
        'relative flex border-b border-border/60 bg-background/80 px-[0.65rem] py-[0.6rem] text-left text-[0.68rem] leading-[1.2] font-medium uppercase tracking-[0.1em] text-muted',
        header.column.id === SQLITE_ROW_NUMBER_COLUMN_ID && 'w-[4.5rem]',
        header.column.getIsResizing() && 'bg-accent/5',
      )}
      style={{
        width: header.getSize(),
      }}
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5 pr-2">
        <div className="min-w-0">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </div>
      {header.column.getCanResize() ? (
        <div
          aria-hidden="true"
          className="absolute inset-y-1.5 -right-2 z-30 w-4 cursor-col-resize touch-none select-none"
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        >
          <span
            className={joinClassNames(
              'pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 rounded-full bg-border/90 transition-colors',
              header.column.getIsResizing() && 'bg-accent ring-1 ring-accent/25',
            )}
          />
        </div>
      ) : null}
    </th>
  );
};

export const SqliteDataTable = <TData extends RowData>({
  tableId,
  data,
  columns,
  columnOrder,
  onColumnOrderChange,
  emptyTitle,
  emptyDescription,
  loading = false,
  loadingColumnCount,
  shellClassName,
  scrollContainerClassName,
  tableClassName,
  showRowNumbers = false,
  rowNumberOffset = 0,
  onRowClick,
  getRowAriaLabel,
}: SqliteDataTableProps<TData>) => {
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  const rowNumberColumn = useMemo<ColumnDef<TData, unknown>>(
    () => ({
      id: SQLITE_ROW_NUMBER_COLUMN_ID,
      header: '#',
      enableResizing: false,
      size: 72,
      minSize: 72,
      maxSize: 72,
      cell: ({ row }) => (
        <span className="sqlite-tabular text-muted">
          {formatNumber(rowNumberOffset + row.index + 1)}
        </span>
      ),
    }),
    [rowNumberOffset],
  );

  const tableColumns = useMemo(
    () => (showRowNumbers ? [rowNumberColumn, ...columns] : columns),
    [columns, rowNumberColumn, showRowNumbers],
  );

  const table = useReactTable({
    data,
    columns: tableColumns,
    defaultColumn: {
      minSize: 120,
      size: 220,
    },
    state: {
      columnOrder,
      columnSizing,
    },
    onColumnOrderChange,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
  });

  const loadingColumns =
    loadingColumnCount ?? columns.length + (showRowNumbers ? 1 : 0);
  const tableRows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => 36,
    overscan: 10,
    getItemKey: (index) => tableRows[index]?.id ?? index,
    measureElement:
      typeof window !== 'undefined' &&
      !window.navigator.userAgent.includes('Firefox')
        ? (element) => element?.getBoundingClientRect().height ?? 0
        : undefined,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  const handleRowKeyDown = (
    event: ReactKeyboardEvent<HTMLTableRowElement>,
    row: TData,
    rowIndex: number,
  ) => {
    if (!onRowClick || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    onRowClick(row, rowIndex);
  };

  const renderTable = (): ReactNode => (
    <table
      className={joinClassNames(
        'grid w-full border-separate border-spacing-0',
        tableClassName,
      )}
      style={{ minWidth: table.getTotalSize() }}
    >
      <thead className="grid">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="flex w-full">
            {headerGroup.headers.map((header) => (
              <SortableColumnHeader key={header.id} header={header} />
            ))}
          </tr>
        ))}
      </thead>
      <tbody
        className="relative grid"
        style={{
          height: rowVirtualizer.getTotalSize(),
        }}
      >
        {virtualRows.map((virtualRow) => {
          const row = tableRows[virtualRow.index];

          if (!row) {
            return null;
          }

          return (
            <tr
              key={row.id}
              ref={(node) => {
                if (node) {
                  rowVirtualizer.measureElement(node);
                }
              }}
              data-index={virtualRow.index}
              className={joinClassNames(
                'group absolute left-0 top-0 flex w-full',
                onRowClick && 'cursor-pointer focus:outline-none',
              )}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              aria-label={
                onRowClick
                  ? (getRowAriaLabel?.(row.original, row.index) ??
                    `Inspect row ${row.index + 1}`)
                  : undefined
              }
              onClick={() => onRowClick?.(row.original, row.index)}
              onKeyDown={(event) =>
                handleRowKeyDown(event, row.original, row.index)
              }
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={joinClassNames(
                    'flex items-start border-b border-border/60 px-[0.65rem] py-[0.55rem] align-top leading-[1.35] text-foreground transition-colors group-hover:bg-accent/4 group-focus-within:bg-accent/8',
                    cell.column.id === SQLITE_ROW_NUMBER_COLUMN_ID &&
                      'sqlite-tabular w-[4.5rem] text-muted',
                  )}
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div
      className={joinClassNames(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        shellClassName,
      )}
      data-table-id={tableId}
    >
      <div
        ref={scrollElementRef}
        className={joinClassNames(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-auto',
          scrollContainerClassName,
        )}
      >
        {loading ? (
          <LoadingState columns={loadingColumns} />
        ) : data.length === 0 || columns.length === 0 ? (
          <div className="flex min-h-[12rem] flex-1 items-center justify-center rounded-xl bg-background/70 p-4">
            <div className="max-w-sm space-y-2 text-center">
              <p className="text-base font-medium text-foreground">
                {emptyTitle}
              </p>
              <p className="text-sm text-muted">{emptyDescription}</p>
            </div>
          </div>
        ) : (
          renderTable()
        )}
      </div>
    </div>
  );
};
