import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { cn } from '../utils/cn';
import { SortIcon } from '../utils/sort-icon';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- required by the RowData constraint of TableMeta
  interface TableMeta<TData> {
    /** Commits an inline edit made in a cell back to the caller's data. */
    updateData: (rowIndex: number, columnId: string, value: unknown) => void;
  }
}

export type DataTableColumn<TRow> = ColumnDef<TRow, any>;

export type DataTableProps<TRow> = {
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  /** Accessible name for the table. */
  ariaLabel?: string;
  className?: string;
  /** Shows a loading row in place of the table body. */
  loading?: boolean;
  /** Shown instead of rows when `data` is empty and not loading. */
  emptyMessage?: ReactNode;
  onRowClick?: (row: TRow) => void;
  /**
   * Called when a cell editor commits a new value. Wire this up to your own
   * state update (e.g. `updateCellValue` from this package) and pass the
   * updated array back in as `data`.
   */
  onCellEdit?: (rowIndex: number, columnId: string, value: unknown) => void;
  getRowId?: (row: TRow, index: number) => string;
};

/** A sortable table for displaying structured row data. */
export function DataTable<TRow>({
  columns,
  data,
  ariaLabel,
  className,
  loading = false,
  emptyMessage = 'No data.',
  onRowClick,
  onCellEdit,
  getRowId,
}: DataTableProps<TRow>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
    meta: {
      updateData: (rowIndex, columnId, value) => {
        onCellEdit?.(rowIndex, columnId, value);
      },
    },
  });

  const columnCount = columns.length;

  return (
    <table
      aria-label={ariaLabel}
      data-slot="data-table"
      className={cn('w-full border-collapse text-sm', className)}
    >
      <thead data-slot="data-table-head">
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id} className="border-b border-border">
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
                  className="h-8 px-3 text-left text-xs font-medium text-muted-foreground"
                  scope="col"
                >
                  {header.isPlaceholder ? null : canSort ? (
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      <SortIcon direction={sortDirection} />
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody data-slot="data-table-body">
        {loading ? (
          <tr>
            <td colSpan={columnCount} className="h-16 text-center text-xs text-muted-foreground">
              Loading…
            </td>
          </tr>
        ) : data.length === 0 ? (
          <tr>
            <td colSpan={columnCount} className="h-16 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </td>
          </tr>
        ) : (
          table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={cn(
                'border-b border-border last:border-0',
                onRowClick && 'cursor-pointer hover:bg-accent/50',
              )}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-1.5 text-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
