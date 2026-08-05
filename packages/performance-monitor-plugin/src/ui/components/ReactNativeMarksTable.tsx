import { ColumnDef } from '@tanstack/react-table';
import { Text } from '@radix-ui/themes';
import { SerializedPerformanceReactNativeMark } from '../../shared/types';
import { DataTable } from './DataTable';
import { formatTime } from '../utils';

export type ReactNativeMarksTableProps = {
  reactNativeMarks: SerializedPerformanceReactNativeMark[];
  onRowClick?: (mark: SerializedPerformanceReactNativeMark) => void;
};

const columns: ColumnDef<SerializedPerformanceReactNativeMark>[] = [
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

export const ReactNativeMarksTable = ({
  reactNativeMarks,
  onRowClick,
}: ReactNativeMarksTableProps) => {
  return (
    <DataTable
      data={reactNativeMarks}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No React Native marks recorded"
    />
  );
};
