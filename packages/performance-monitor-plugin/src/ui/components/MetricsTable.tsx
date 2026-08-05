import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { Text } from '@radix-ui/themes';
import { SerializedPerformanceMetric } from '../../shared/types';
import { DataTable } from './DataTable';
import { formatTime } from '../utils';

export type MetricsTableProps = {
  metrics: SerializedPerformanceMetric[];
  onRowClick?: (metric: SerializedPerformanceMetric) => void;
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
  return (
    <DataTable
      data={metrics}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No metrics recorded"
    />
  );
};
