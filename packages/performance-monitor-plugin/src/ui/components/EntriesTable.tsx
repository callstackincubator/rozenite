import type { ColumnDef } from '@tanstack/react-table';
import { Badge, VirtualizedDataTable } from '@rozenite/ui';
import type { SerializedPerformanceEntry } from '../../shared/types';
import { formatDuration, formatTime } from '../utils';
import { ENTRY_TYPE_LABELS } from '../entry-types';
import { getEntryKey, getEntryValueLabel } from '../waterfall';

export type EntriesTableProps = {
  entries: SerializedPerformanceEntry[];
  onRowClick: (entry: SerializedPerformanceEntry) => void;
  emptyMessage?: string;
};

// Unified [Name, Type, Value, Duration, Start] table replacing the five
// per-type tables (Measures/Metrics/Marks/RN Marks/Resources). Metrics'
// `value` and Resources' `transferSize` share one "Value" column via
// `getEntryValueLabel` (already used by the waterfall's row meta) so neither
// gets lost without adding two mostly-empty dedicated columns; their full
// detail still lives in `DetailPane`.
const columns: ColumnDef<SerializedPerformanceEntry>[] = [
  {
    id: 'name',
    accessorFn: (entry) => entry.name,
    header: 'Name',
    cell: ({ row }) => {
      const entry = row.original;
      const isDerivedFromReactNativeMark = 'derivedFromReactNativeMark' in entry;

      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-foreground" title={entry.name}>
            {entry.name}
          </span>
          {isDerivedFromReactNativeMark && (
            <Badge variant="secondary" className="shrink-0">
              RN
            </Badge>
          )}
        </div>
      );
    },
  },
  {
    id: 'entryType',
    accessorFn: (entry) => entry.entryType,
    header: 'Type',
    cell: ({ row }) => <Badge variant="outline">{ENTRY_TYPE_LABELS[row.original.entryType]}</Badge>,
  },
  {
    id: 'value',
    header: 'Value',
    enableSorting: false,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {getEntryValueLabel(row.original) ?? '—'}
      </span>
    ),
  },
  {
    id: 'duration',
    accessorFn: (entry) => entry.duration,
    header: 'Duration',
    cell: ({ row }) => (
      <span className="tabular-nums text-foreground">{formatDuration(row.original.duration)}</span>
    ),
  },
  {
    id: 'startTime',
    accessorFn: (entry) => entry.startTime,
    header: 'Start',
    cell: ({ row }) => (
      <span className="tabular-nums text-xs text-muted-foreground">
        {formatTime(row.original.startTime)}
      </span>
    ),
  },
];

export const EntriesTable = ({ entries, onRowClick, emptyMessage }: EntriesTableProps) => (
  <VirtualizedDataTable
    ariaLabel="Performance entries"
    data={entries}
    columns={columns}
    getRowId={(entry, index) => getEntryKey(entry, index)}
    getRowTextValue={(entry) => entry.name}
    onRowClick={onRowClick}
    emptyMessage={emptyMessage ?? 'No performance entries recorded'}
    style={{ height: '100%' }}
    scrollClassName="h-full w-full overflow-auto"
  />
);
