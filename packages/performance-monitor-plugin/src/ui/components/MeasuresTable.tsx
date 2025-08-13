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
import { SerializedPerformanceMeasure } from '../../shared/types';

export type MeasuresTableProps = {
  measures: SerializedPerformanceMeasure[];
  onRowClick?: (measure: SerializedPerformanceMeasure) => void;
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};

const formatDuration = (duration: number) => {
  if (duration < 1) {
    return `${(duration * 1000).toFixed(2)}ms`;
  }
  return `${duration.toFixed(2)}s`;
};

const columns: ColumnDef<SerializedPerformanceMeasure>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <Text weight="medium">{row.getValue('name')}</Text>,
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => {
      const duration = row.getValue('duration') as number;
      return <Text color="blue">{formatDuration(duration)}</Text>;
    },
  },
  {
    accessorKey: 'startTime',
    header: 'Start Time',
    cell: ({ row }) => {
      const startTime = row.getValue('startTime') as number;
      return (
        <Text size="2" color="gray">
          {formatTime(startTime)}
        </Text>
      );
    },
  },
  {
    id: 'endTime',
    header: 'End Time',
    cell: ({ row }) => {
      const startTime = row.getValue('startTime') as number;
      const duration = row.getValue('duration') as number;
      const endTime = startTime + duration;
      return (
        <Text size="2" color="gray">
          {formatTime(endTime)}
        </Text>
      );
    },
  },
];

export const MeasuresTable = ({ measures, onRowClick }: MeasuresTableProps) => {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data: measures,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (measures.length === 0) {
    return (
      <Text
        size="3"
        color="gray"
        style={{ textAlign: 'center', padding: '0 20px', fontStyle: 'italic' }}
      >
        No measures recorded
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
