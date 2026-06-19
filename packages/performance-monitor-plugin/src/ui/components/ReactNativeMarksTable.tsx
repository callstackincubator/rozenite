import { ColumnDef } from '@tanstack/react-table';
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
    cell: ({ row }) => (
      <span className="font-medium text-foreground">
        {String(row.getValue('name'))}
      </span>
    ),
  },
  {
    accessorKey: 'startTime',
    header: 'Recorded At',
    cell: ({ row }) => {
      const startTime = row.getValue('startTime') as number;
      return (
        <span className="tabular-nums text-sm text-muted">
          {formatTime(startTime)}
        </span>
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
      ariaLabel="React Native marks"
      data={reactNativeMarks}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No React Native marks recorded"
      getRowTextValue={(mark) => mark.name}
    />
  );
};
