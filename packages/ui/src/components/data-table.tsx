import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { ChevronUp } from 'lucide-react';
import { Table } from '@heroui/react';

declare module '@tanstack/react-table' {
  // Lets a column carry an optional className applied to its body cells. The
  // type parameters must mirror tanstack's signature for declaration merging,
  // even though this augmentation doesn't reference them.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    cellClassName?: string;
  }
}

export type DataTableProps<TData> = {
  ariaLabel: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  /** Stable row id. Defaults to the tanstack row index. */
  getRowId?: (item: TData, index: number) => string;
  getRowTextValue?: (item: TData, index: number) => string;
  onRowClick?: (item: TData) => void;
  emptyMessage?: string;
  /** Overrides the default centered `emptyMessage` rendering. */
  renderEmptyState?: () => ReactNode;
  className?: string;
  scrollClassName?: string;
};

type TableSortDescriptor = NonNullable<
  ComponentProps<typeof Table.Content>['sortDescriptor']
>;

function toSortDescriptor(
  sorting: SortingState,
): TableSortDescriptor | undefined {
  const firstSort = sorting[0];

  if (!firstSort) {
    return undefined;
  }

  return {
    column: firstSort.id,
    direction: firstSort.desc ? 'descending' : 'ascending',
  };
}

function toSortingState(descriptor: TableSortDescriptor): SortingState {
  return [
    {
      desc: descriptor.direction === 'descending',
      id: String(descriptor.column),
    },
  ];
}

function SortableColumnHeader({
  children,
  sortDirection,
}: {
  children: ReactNode;
  sortDirection?: 'ascending' | 'descending';
}) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{children}</span>
      {sortDirection ? (
        <ChevronUp
          className={`size-3 shrink-0 transition-transform duration-100 ease-out ${
            sortDirection === 'descending' ? 'rotate-180' : ''
          }`}
        />
      ) : null}
    </span>
  );
}

export const DataTable = <TData,>({
  ariaLabel,
  data,
  columns,
  getRowId,
  getRowTextValue,
  onRowClick,
  emptyMessage = 'No data available',
  renderEmptyState,
  className = 'min-h-0 flex-1 overflow-hidden border border-border/70 bg-surface shadow-sm',
  scrollClassName = 'h-full w-full',
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const sortDescriptor = useMemo(() => toSortDescriptor(sorting), [sorting]);

  return (
    <Table className={className} variant="secondary">
      <Table.ScrollContainer className={scrollClassName}>
        <Table.Content
          aria-label={ariaLabel}
          className="min-w-full"
          onRowAction={
            onRowClick
              ? (key) => {
                  const row = rows.find((item) => item.id === String(key));

                  if (row) {
                    onRowClick(row.original);
                  }
                }
              : undefined
          }
          onSortChange={(descriptor) => setSorting(toSortingState(descriptor))}
          sortDescriptor={sortDescriptor}
        >
          <Table.Header>
            {table.getHeaderGroups().map((headerGroup) =>
              headerGroup.headers.map((header) => (
                <Table.Column
                  key={header.id}
                  allowsSorting={header.column.getCanSort()}
                  id={header.id}
                  isRowHeader={header.column.getIndex() === 0}
                >
                  {({ sortDirection }) =>
                    header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <SortableColumnHeader sortDirection={sortDirection}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </SortableColumnHeader>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )
                  }
                </Table.Column>
              )),
            )}
          </Table.Header>
          <Table.Body
            renderEmptyState={
              renderEmptyState ??
              (() => (
                <div className="flex h-full min-h-56 w-full items-center justify-center px-4 py-10 text-center">
                  <span className="text-sm text-muted">{emptyMessage}</span>
                </div>
              ))
            }
          >
            {rows.map((row) => (
              <Table.Row
                key={row.id}
                className={`transition-colors hover:bg-surface-secondary/70 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
                id={row.id}
                textValue={
                  getRowTextValue?.(row.original, row.index) ?? String(row.id)
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <Table.Cell
                    key={cell.id}
                    className={cell.column.columnDef.meta?.cellClassName}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Cell>
                ))}
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
};
