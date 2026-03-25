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
import {
  useMemo,
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
  <div className="sqlite-results-loading" aria-live="polite">
    {Array.from({ length: 6 }, (_, rowIndex) => (
      <div
        key={`loading-${rowIndex}`}
        className="sqlite-results-loading-row"
        style={{
          gridTemplateColumns: `repeat(${Math.max(columns, 3)}, minmax(12rem, 1fr))`,
        }}
      >
        {Array.from({ length: Math.max(columns, 3) }, (_, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className="sqlite-results-loading-bar"
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
        header.column.id === SQLITE_ROW_NUMBER_COLUMN_ID &&
          'sqlite-results-number-col',
        header.column.getIsResizing() && 'sqlite-table-column-resizing',
      )}
      style={{
        width: header.getSize(),
      }}
    >
      <div className="sqlite-table-header-content">
        <div className="min-w-0">
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      </div>
      {header.column.getCanResize() ? (
        <div
          aria-hidden="true"
          className={joinClassNames(
            'sqlite-column-resizer',
            header.column.getIsResizing() && 'is-active',
          )}
          onDoubleClick={() => header.column.resetSize()}
          onMouseDown={header.getResizeHandler()}
          onTouchStart={header.getResizeHandler()}
        />
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

  const rowNumberColumn = useMemo<ColumnDef<TData, unknown>>(
    () => ({
      id: SQLITE_ROW_NUMBER_COLUMN_ID,
      header: '#',
      enableResizing: false,
      size: 72,
      minSize: 72,
      maxSize: 72,
      cell: ({ row }) => (
        <span className="sqlite-results-row-number sqlite-tabular">
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
      className={joinClassNames('sqlite-results-table', tableClassName)}
      style={{ minWidth: table.getTotalSize() }}
    >
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <SortableColumnHeader key={header.id} header={header} />
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr
            key={row.id}
            className={joinClassNames(onRowClick && 'sqlite-results-row')}
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
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className={joinClassNames(
                  cell.column.id === SQLITE_ROW_NUMBER_COLUMN_ID &&
                    'sqlite-results-row-number',
                )}
                style={{ width: cell.column.getSize() }}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div
      className={joinClassNames('sqlite-results-shell', shellClassName)}
      data-table-id={tableId}
    >
      <div
        className={joinClassNames(
          'sqlite-results-scroll',
          scrollContainerClassName,
        )}
      >
        {loading ? (
          <LoadingState columns={loadingColumns} />
        ) : data.length === 0 || columns.length === 0 ? (
          <div className="sqlite-results-empty">
            <div className="max-w-sm space-y-2 text-center">
              <p className="text-base font-medium text-white">{emptyTitle}</p>
              <p className="text-sm text-slate-400">{emptyDescription}</p>
            </div>
          </div>
        ) : (
          renderTable()
        )}
      </div>
    </div>
  );
};
