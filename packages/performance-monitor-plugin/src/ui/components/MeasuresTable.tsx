import { ColumnDef } from '@tanstack/react-table';
import { Text } from '@radix-ui/themes';
import { SerializedPerformanceMeasure } from '../../shared/types';
import { DataTable } from './DataTable';
import { formatTime, formatDuration } from '../utils';

export type MeasuresTableProps = {
  measures: SerializedPerformanceMeasure[];
  onRowClick?: (measure: SerializedPerformanceMeasure) => void;
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
  return (
    <DataTable
      data={measures}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No measures recorded"
    />
  );
};
