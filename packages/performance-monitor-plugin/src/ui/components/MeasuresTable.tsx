import React from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  getSortedRowModel,
  SortingState,
  ColumnDef,
} from '@tanstack/react-table';
import { Table, Text, Flex, Box } from '@radix-ui/themes';
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
    accessorFn: (row) => row.startTime + row.duration,
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
      <Box pt="3" pl="3">
        <Text size="2" color="gray">
          No measures recorded
        </Text>
      </Box>
    );
  }

  return (
    <Table.Root style={{ overflow: 'auto', flexGrow: 1 }}>
      <Table.Header
        style={{
          position: 'sticky',
          top: 0,
          backgroundColor: 'hsl(0 0% 3.9%)',
          zIndex: 1,
        }}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <Table.ColumnHeaderCell
                key={header.id}
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
              </Table.ColumnHeaderCell>
            ))}
          </Table.Row>
        ))}
      </Table.Header>
      <Table.Body style={{ flex: '1', overflow: 'auto' }}>
        {table.getRowModel().rows.map((row) => (
          <Table.Row
            key={row.id}
            onClick={() => onRowClick?.(row.original)}
            style={{
              cursor: onRowClick ? 'pointer' : 'default',
              transition: 'background-color 0.15s ease',
            }}
            className="table-row-hover"
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
