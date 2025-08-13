import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { Table, Text, Flex } from '@radix-ui/themes';
import { SerializedPerformanceMetric } from '../../shared/types';

export type MetricsTableProps = {
  metrics: SerializedPerformanceMetric[];
  onRowClick?: (metric: SerializedPerformanceMetric) => void;
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const columns: ColumnDef<SerializedPerformanceMetric>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <Text weight="medium">{row.getValue('name')}</Text>,
  },
  {
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => {
      const value = row.getValue('value');
      return (
        <Text color="green" weight="medium">
          {String(value)}
        </Text>
      );
    },
  },
  {
    accessorKey: 'startTime',
    header: 'Recorded at',
    cell: ({ row }) => {
      const startTime = row.getValue('startTime') as number;
      return (
        <Text size="2" color="gray">
          {formatTime(startTime)}
        </Text>
      );
    },
  },
];

export const MetricsTable = ({ metrics, onRowClick }: MetricsTableProps) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data: metrics,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (metrics.length === 0) {
    return (
      <Text
        size="3"
        color="gray"
        style={{ textAlign: 'center', padding: '0 20px', fontStyle: 'italic' }}
      >
        No metrics recorded
      </Text>
    );
  }

  return (
    <Table.Root>
      <Table.Header>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.ColumnHeaderCell key={header.id}>
                <Flex align="center" gap="2">
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {header.column.getCanSort() && (
                    <Text size="1" color="gray">
                      {{
                        asc: '↑',
                        desc: '↓',
                      }[header.column.getIsSorted() as string] ?? '↕'}
                    </Text>
                  )}
                </Flex>
              </Table.ColumnHeaderCell>
            ))}
          </Table.Row>
        ))}
      </Table.Header>
      <Table.Body>
        {table.getRowModel().rows.map((row) => (
          <Table.Row
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            style={{ cursor: onRowClick ? 'pointer' : 'default' }}
          >
            {row.getVisibleCells().map((cell) => (
              <Table.Cell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
};
