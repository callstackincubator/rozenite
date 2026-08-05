import { ColumnDef } from '@tanstack/react-table';
import { Text } from '@radix-ui/themes';
import { SerializedPerformanceResource } from '../../shared/types';
import { DataTable } from './DataTable';
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
      <Text weight="medium" style={{ wordBreak: 'break-all' }}>
        {row.getValue('name')}
      </Text>
    ),
  },
  {
    accessorKey: 'initiatorType',
    header: 'Type',
    cell: ({ row }) => (
      <Text size="2" color="gray">
        {(row.getValue('initiatorType') as string | undefined) ?? '—'}
      </Text>
    ),
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
    accessorKey: 'transferSize',
    header: 'Size',
    cell: ({ row }) => {
      const size = row.getValue('transferSize') as number;
      return (
        <Text size="2" color="gray">
          {formatBytes(size)}
        </Text>
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
      data={resources}
      columns={columns}
      onRowClick={onRowClick}
      emptyMessage="No resources recorded"
    />
  );
};
