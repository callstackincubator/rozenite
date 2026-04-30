import type { ComponentProps, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Table } from '@rozenite/ui';

export type DataTableProps<TData> = {
  ariaLabel: string;
  data: TData[];
  columns: ColumnDef<TData>[];
  emptyMessage?: string;
  getRowTextValue?: (item: TData, index: number) => string;
  onRowClick?: (item: TData) => void;
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
        <span
          aria-hidden="true"
          className="text-[11px] font-medium text-muted"
        >
          {sortDirection === 'ascending' ? '↑' : '↓'}
        </span>
      ) : null}
    </span>
  );
}

export const DataTable = <TData,>({
  ariaLabel,
  data,
  columns,
  emptyMessage = 'No data available',
  getRowTextValue,
  onRowClick,
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const sortDescriptor = useMemo(() => toSortDescriptor(sorting), [sorting]);

  return (
    <Table
      className="min-h-0 flex-1 overflow-hidden border border-border/70 bg-surface shadow-sm"
      variant="secondary"
    >
      <Table.ScrollContainer className="h-full w-full">
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
            renderEmptyState={() => (
              <div className="flex h-full min-h-56 w-full items-center justify-center px-4 py-10 text-center">
                <span className="text-sm text-muted">{emptyMessage}</span>
              </div>
            )}
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
                  <Table.Cell key={cell.id}>
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
