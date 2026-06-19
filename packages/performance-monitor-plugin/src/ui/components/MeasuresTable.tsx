import type { ColumnDef } from '@tanstack/react-table';
import type { SerializedPerformanceMeasure } from '../../shared/types';
import { formatDuration, formatTime } from '../utils';
import { DataTable } from './DataTable';

export type MeasuresTableProps = {
  measures: SerializedPerformanceMeasure[];
  onRowClick?: (measure: SerializedPerformanceMeasure) => void;
};

const columns: ColumnDef<SerializedPerformanceMeasure>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="flex items-center gap-2">
        <span className="font-medium text-foreground">
          {String(row.getValue('name'))}
        </span>
        {'derivedFromReactNativeMark' in row.original && (
          <span className="rounded bg-muted/20 px-1 py-0.5 text-xs text-muted">
            RN
          </span>
        )}
      </span>
    ),
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => (
      <span className="font-medium text-accent">
        {formatDuration(row.getValue('duration') as number)}
      </span>
    ),
  },
  {
    accessorKey: 'startTime',
    header: 'Start Time',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted">
        {formatTime(row.getValue('startTime') as number)}
      </span>
    ),
  },
  {
    id: 'endTime',
    accessorFn: (row) => row.startTime + row.duration,
    header: 'End Time',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted">
        {formatTime((row.original.startTime ?? 0) + row.original.duration)}
      </span>
    ),
  },
];

export const MeasuresTable = ({
  measures,
  onRowClick,
}: MeasuresTableProps) => {
  return (
    <DataTable
      ariaLabel="Performance measures"
      columns={columns}
      data={measures}
      emptyMessage="No measures recorded"
      getRowTextValue={(measure) => measure.name}
      onRowClick={onRowClick}
    />
  );
};
