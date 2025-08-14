import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { TableVirtuoso } from 'react-virtuoso';
import { Text, Flex, Box } from '@radix-ui/themes';
import { useState } from 'react';

export type DataTableProps<TData> = {
  data: TData[];
  columns: ColumnDef<TData>[];
  onRowClick?: (item: TData) => void;
  emptyMessage?: string;
};

export const DataTable = <TData,>({
  data,
  columns,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<TData>) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const { rows } = table.getRowModel();

  if (data.length === 0) {
    return (
      <Box pt="3" pl="3">
        <Text size="2" color="gray">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <div className="data-table-container">
      <TableVirtuoso
        style={{ height: '100%' }}
        totalCount={rows.length}
        components={{
          Table: (props) => <table {...props} className="data-table" />,
          TableRow: (props) => {
            const index = props['data-index'];
            const row = rows[index];

            return (
              <tr
                {...props}
                onClick={() => onRowClick?.(row.original)}
                style={{
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 0.15s ease',
                }}
                className="data-table-row"
              >
                <td className="data-table-cell index-cell">{index + 1}</td>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="data-table-cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          },
        }}
        fixedHeaderContent={() => {
          return table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="data-table-header-row">
              <th className="data-table-header-cell index-header">#</th>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="data-table-header-cell"
                  onClick={header.column.getToggleSortingHandler()}
                  style={{
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                  }}
                >
                  <Flex align="center" gap="2">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanSort() && (
                      <Text size="1" color="gray">
                        {{
                          asc: '⬆️',
                          desc: '⬇️',
                        }[header.column.getIsSorted() as string] ?? '↕️'}
                      </Text>
                    )}
                  </Flex>
                </th>
              ))}
            </tr>
          ));
        }}
      />
    </div>
  );
};
