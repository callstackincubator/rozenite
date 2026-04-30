import { useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Button, Chip, Table } from '@rozenite/ui';
import { ChevronUp, Edit3, Inbox, Loader2, Trash2 } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';
import { EditEntryDialog } from './edit-entry-dialog';

export type EditableTableProps = {
  data: StorageEntry[];
  supportedTypes: StorageEntryType[];
  onValueChange?: (key: string, newValue: StorageEntryValue) => void;
  onDeleteEntry?: (key: string) => void;
  onRowClick?: (entry: StorageEntry) => void;
  loading?: boolean;
  searchTerm?: string;
};

const typeColorMap: Record<
  string,
  'success' | 'danger' | 'warning' | 'accent' | 'default'
> = {
  string: 'success',
  number: 'default',
  boolean: 'warning',
  buffer: 'accent',
};

const columnHelper = createColumnHelper<StorageEntry>();
type TableSortDescriptor = NonNullable<
  ComponentProps<typeof Table.Content>['sortDescriptor']
>;

function toSortDescriptor(
  sorting: SortingState,
): TableSortDescriptor | undefined {
  const firstSort = sorting[0];

  if (!firstSort) {
    return undefined;
  }

  return {
    column: firstSort.id,
    direction: firstSort.desc ? 'descending' : 'ascending',
  };
}

function toSortingState(descriptor: TableSortDescriptor): SortingState {
  return [
    {
      desc: descriptor.direction === 'descending',
      id: String(descriptor.column),
    },
  ];
}

function SortableColumnHeader({
  children,
  sortDirection,
}: {
  children: ReactNode;
  sortDirection?: 'ascending' | 'descending';
}) {
  return (
    <span className="flex items-center justify-between gap-2">
      <span>{children}</span>
      {sortDirection ? (
        <ChevronUp
          className={`size-3 shrink-0 transition-transform duration-100 ease-out ${
            sortDirection === 'descending' ? 'rotate-180' : ''
          }`}
        />
      ) : null}
    </span>
  );
}

export const EditableTable = ({
  data,
  supportedTypes,
  onValueChange,
  onDeleteEntry,
  onRowClick,
  loading = false,
  searchTerm = '',
}: EditableTableProps) => {
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryKey: string;
  }>({ isOpen: false, entryKey: '' });

  const columns = useMemo(
    () => [
      columnHelper.accessor('key', {
        header: 'Key',
        enableSorting: true,
        cell: ({ getValue }) => (
          <span className="font-mono text-sm text-foreground">
            {getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        enableSorting: true,
        cell: (info) => {
          const type = info.getValue() as StorageEntryType;

          return (
            <Chip
              color={typeColorMap[info.getValue()]}
              size="sm"
              variant="soft"
            >
              {type}
            </Chip>
          );
        },
      }),
      columnHelper.accessor('value', {
        header: 'Value',
        cell: ({ row }) => (
          <div className="min-w-0">{formatValue(row.original)}</div>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              aria-label={`Edit value for ${row.original.key}`}
              isDisabled={!onValueChange}
              isIconOnly
              onClick={(event) => event.stopPropagation()}
              onPress={() => handleEdit(row.original)}
              size="sm"
              variant="ghost"
            >
              <Edit3 className="size-4 text-muted" />
            </Button>
            <Button
              aria-label={`Delete entry ${row.original.key}`}
              isDisabled={!onDeleteEntry}
              isIconOnly
              onClick={(event) => event.stopPropagation()}
              onPress={() => handleDelete(row.original.key)}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="size-4 text-danger" />
            </Button>
          </div>
        ),
      }),
    ],
    [onDeleteEntry, onValueChange],
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const sortDescriptor = useMemo(() => toSortDescriptor(sorting), [sorting]);

  const handleEdit = (entry: StorageEntry) => {
    setEditingEntry(entry);
  };

  const handleEditEntry = (key: string, newValue: StorageEntryValue) => {
    if (onValueChange) {
      onValueChange(key, newValue);
    }

    setEditingEntry(null);
  };

  const handleCloseEditDialog = () => {
    setEditingEntry(null);
  };

  const handleDelete = (key: string) => {
    if (onDeleteEntry) {
      setDeleteConfirm({ isOpen: true, entryKey: key });
    }
  };

  const confirmDelete = () => {
    if (onDeleteEntry && deleteConfirm.entryKey) {
      onDeleteEntry(deleteConfirm.entryKey);
    }

    setDeleteConfirm({ isOpen: false, entryKey: '' });
  };

  if (loading) {
    return (
      <div className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm">
        <Loader2 className="size-8 animate-spin text-accent" />
        <p>Loading entries...</p>
      </div>
    );
  }

  return (
    <>
      <Table
        className="w-full border border-border/70 bg-surface shadow-sm"
        variant="secondary"
      >
        <Table.ScrollContainer className="w-full">
          <Table.Content
            aria-label="Storage entries"
            className="min-w-full"
            onRowAction={(key) => {
              const entry = data.find((item) => item.key === String(key));
              if (entry) {
                onRowClick?.(entry);
              }
            }}
            onSortChange={(descriptor) =>
              setSorting(toSortingState(descriptor))
            }
            sortDescriptor={sortDescriptor}
          >
            <Table.Header>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <Table.Column
                  key={header.id}
                  allowsSorting={header.column.getCanSort()}
                  id={header.id}
                  isRowHeader={header.id === 'key'}
                >
                  {({ sortDirection }) =>
                    header.column.getCanSort() ? (
                      <SortableColumnHeader sortDirection={sortDirection}>
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                      </SortableColumnHeader>
                    ) : (
                      flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )
                    )
                  }
                </Table.Column>
              ))}
            </Table.Header>
            <Table.Body
              renderEmptyState={() => (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-10 text-center">
                  <Inbox className="size-6 text-muted" />
                  <span className="text-sm text-muted">
                    {searchTerm
                      ? 'No results found'
                      : 'This storage appears to be empty'}
                  </span>
                </div>
              )}
            >
              {table.getRowModel().rows.map((row) => (
                <Table.Row
                  key={row.original.key}
                  className={`transition-colors hover:bg-surface-secondary/70 ${
                    onRowClick ? 'cursor-pointer' : ''
                  }`}
                  id={row.original.key}
                  textValue={row.original.key}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell
                      key={cell.id}
                      className={
                        cell.column.id === 'value' ? 'min-w-0' : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>

      <EditEntryDialog
        onClose={handleCloseEditDialog}
        onEditEntry={handleEditEntry}
        entry={editingEntry}
        supportedTypes={supportedTypes}
      />

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, entryKey: '' })}
        onConfirm={confirmDelete}
        title="Delete Entry"
        message={`Are you sure you want to delete the entry "${deleteConfirm.entryKey}"?`}
        type="confirm"
        confirmText="Delete"
      />
    </>
  );
};

const formatValue = (entry: StorageEntry) => {
  if (entry.type === 'string') {
    return (
      <span className="font-mono text-sm text-success">"{entry.value}"</span>
    );
  }

  if (entry.type === 'number') {
    return (
      <span className="font-mono text-sm text-foreground">{entry.value}</span>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <span className={'font-mono text-sm text-warning'}>
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  const displayValue =
    entry.value.length > 5
      ? `[${entry.value.slice(0, 5).join(', ')}, ...${entry.value.length - 5} more]`
      : `[${entry.value.join(', ')}]`;

  return <span className="font-mono text-sm text-accent">{displayValue}</span>;
};
