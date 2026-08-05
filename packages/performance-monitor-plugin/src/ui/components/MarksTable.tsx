import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Text } from '@radix-ui/themes';
import { SerializedPerformanceMark } from '../../shared/types';
import { DataTable } from './DataTable';
import { formatTime } from '../utils';

export type MarksTableProps = {
  marks: SerializedPerformanceMark[];
  onRowClick?: (mark: SerializedPerformanceMark) => void;
};

const columns: ColumnDef<SerializedPerformanceMark>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <Text weight="medium">{row.getValue('name')}</Text>,
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

export const MarksTable = ({ marks, onRowClick }: MarksTableProps) => {
  return (
    <DataTable
      data={marks}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No marks recorded"
    />
  );
};
