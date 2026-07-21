import { ColumnDef } from '@tanstack/react-table';
import { SerializedPerformanceResource } from '../../shared/types';
import { DataTable } from '@rozenite/ui';
import { formatBytes, formatDuration } from '../utils';

export type ResourcesTableProps = {
  resources: SerializedPerformanceResource[];
  onRowClick?: (resource: SerializedPerformanceResource) => void;
};

const columns: ColumnDef<SerializedPerformanceResource>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <span className="font-medium text-foreground" style={{ wordBreak: 'break-all' }}>
        {String(row.getValue('name'))}
      </span>
    ),
  },
  {
    accessorKey: 'initiatorType',
    header: 'Type',
    cell: ({ row }) => (
      <span className="text-sm text-muted">
        {(row.getValue('initiatorType') as string | undefined) ?? '—'}
      </span>
    ),
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    cell: ({ row }) => {
      const duration = row.getValue('duration') as number;
      return (
        <span className="font-medium tabular-nums text-primary">
          {formatDuration(duration)}
        </span>
      );
    },
  },
  {
    accessorKey: 'transferSize',
    header: 'Size',
    cell: ({ row }) => {
      const size = row.getValue('transferSize') as number;
      return (
        <span className="text-sm text-muted tabular-nums">
          {formatBytes(size)}
        </span>
      );
    },
  },
];

export const ResourcesTable = ({
  resources,
  onRowClick,
}: ResourcesTableProps) => {
  return (
    <DataTable
      ariaLabel="Performance resources"
      data={resources}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No resources recorded"
      getRowTextValue={(resource) => resource.name}
    />
  );
};
