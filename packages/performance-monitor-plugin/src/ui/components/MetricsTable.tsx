import type { ColumnDef } from '@tanstack/react-table';
import type { SerializedPerformanceMetric } from '../../shared/types';
import { formatMetricRawValue, formatMetricValue, formatTime, getMetricUnit } from '../utils';
import { DataTable } from './DataTable';

export type MetricsTableProps = {
  metrics: SerializedPerformanceMetric[];
  onRowClick?: (metric: SerializedPerformanceMetric) => void;
};

const columns: ColumnDef<SerializedPerformanceMetric>[] = [
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
    accessorKey: 'value',
    header: 'Value',
    cell: ({ row }) => {
      const unit = getMetricUnit(row.original.detail);
      const formattedValue = formatMetricValue(row.original.value, {
        mode: 'compact',
        unit,
      });
      const rawValue = formatMetricRawValue(row.original.value, unit);

      return (
        <span
          className="font-medium tabular-nums text-success"
          title={rawValue}
        >
          {formattedValue}
        </span>
      );
    },
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

export const MetricsTable = ({ metrics, onRowClick }: MetricsTableProps) => {
  return (
    <DataTable
      ariaLabel="Performance metrics"
      columns={columns}
      data={metrics}
      emptyMessage="No metrics recorded"
      getRowTextValue={(metric) => metric.name}
      onRowClick={onRowClick}
    />
  );
};
