import type { ColumnDef } from '@tanstack/react-table';
import type { SerializedPerformanceMark } from '../../shared/types';
import { formatTime } from '../utils';
import { DataTable } from './DataTable';

export type MarksTableProps = {
  marks: SerializedPerformanceMark[];
  onRowClick?: (mark: SerializedPerformanceMark) => void;
};

const columns: ColumnDef<SerializedPerformanceMark>[] = [
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
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted">
        {formatTime(row.getValue('startTime') as number)}
      </span>
    ),
  },
];

export const MarksTable = ({ marks, onRowClick }: MarksTableProps) => {
  return (
    <DataTable
      ariaLabel="Performance marks"
      columns={columns}
      data={marks}
      emptyMessage="No marks recorded"
      getRowTextValue={(mark) => mark.name}
      onRowClick={onRowClick}
    />
  );
};
