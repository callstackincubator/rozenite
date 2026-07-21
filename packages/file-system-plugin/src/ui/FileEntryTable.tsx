import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Chip, Surface, Table } from '@rozenite/ui';
import {
  ChevronRight,
  ChevronUp,
  File,
  FileImage,
  FileText,
  Folder,
  Inbox,
  Loader2,
} from 'lucide-react';
import type { FsEntry } from '../shared/protocol';
import { isLikelyImageFile, isLikelyTextFile } from '../shared/path';
import { formatBytes, formatDate } from '../utils';

type FileEntryTableProps = {
  entries: FsEntry[];
  loading?: boolean;
  selectedPath?: string | null;
  onEntryPress: (entry: FsEntry) => void;
};

const columnHelper = createColumnHelper<FsEntry>();

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

function getEntryKind(entry: FsEntry) {
  if (entry.isDirectory) {
    return 'Directory';
  }

  if (isLikelyImageFile(entry.path)) {
    return 'Image';
  }

  if (isLikelyTextFile(entry.path)) {
    return 'Text';
  }

  return 'File';
}

function getEntryKindColor(
  entry: FsEntry,
): 'success' | 'warning' | 'accent' | 'default' {
  if (entry.isDirectory) {
    return 'accent';
  }

  if (isLikelyImageFile(entry.path)) {
    return 'warning';
  }

  if (isLikelyTextFile(entry.path)) {
    return 'success';
  }

  return 'default';
}

function getEntryIcon(entry: FsEntry) {
  if (entry.isDirectory) {
    return Folder;
  }

  if (isLikelyImageFile(entry.path)) {
    return FileImage;
  }

  if (isLikelyTextFile(entry.path)) {
    return FileText;
  }

  return File;
}

export function FileEntryTable({
  entries,
  loading = false,
  selectedPath,
  onEntryPress,
}: FileEntryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = [
    columnHelper.display({
      id: 'icon',
      header: '',
      cell: ({ row }) => {
        const Icon = getEntryIcon(row.original);

        return (
          <span className="flex items-center justify-center">
            <Icon
              className={`size-4 ${
                row.original.isDirectory ? 'text-accent' : 'text-muted'
              }`}
            />
          </span>
        );
      },
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      enableSorting: true,
      cell: ({ row, getValue }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {getValue()}
          </span>
          {row.original.isDirectory ? (
            <ChevronRight className="size-4 shrink-0 text-muted" />
          ) : null}
        </div>
      ),
    }),
    columnHelper.accessor((entry) => getEntryKind(entry), {
      id: 'kind',
      header: 'Kind',
      enableSorting: true,
      cell: ({ row }) => (
        <Chip
          color={getEntryKindColor(row.original)}
          size="sm"
          variant="soft"
        >
          {getEntryKind(row.original)}
        </Chip>
      ),
    }),
    columnHelper.accessor((entry) => entry.isDirectory ? null : entry.size ?? null, {
      id: 'size',
      header: 'Size',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {row.original.isDirectory ? '-' : formatBytes(row.original.size)}
        </span>
      ),
    }),
    columnHelper.accessor((entry) => entry.modifiedAtMs ?? null, {
      id: 'modified',
      header: 'Modified',
      enableSorting: true,
      cell: ({ row }) => (
        <span className="text-sm text-foreground">
          {formatDate(row.original.modifiedAtMs)}
        </span>
      ),
    }),
  ];

  const table = useReactTable({
    data: entries,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (loading) {
    return (
      <Surface
        className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-border/70 bg-surface px-4 py-8 text-center text-sm text-muted shadow-sm"
        variant="secondary"
      >
        <Loader2 className="size-8 animate-spin text-accent" />
        <p>Loading directory contents...</p>
      </Surface>
    );
  }

  return (
    <Table
      className="w-full border border-border/70 bg-surface shadow-sm"
      variant="secondary"
    >
      <Table.ScrollContainer className="w-full">
        <Table.Content
          aria-label="File system entries"
          className="min-w-full"
          onRowAction={(key) => {
            const entry = entries.find((item) => item.path === String(key));
            if (entry) {
              onEntryPress(entry);
            }
          }}
          onSortChange={(descriptor) => setSorting(toSortingState(descriptor))}
          sortDescriptor={toSortDescriptor(sorting)}
        >
          <Table.Header>
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <Table.Column
                key={header.id}
                allowsSorting={header.column.getCanSort()}
                id={header.id}
                isRowHeader={header.id === 'name'}
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
                  This directory appears to be empty.
                </span>
              </div>
            )}
          >
            {table.getRowModel().rows.map((row) => {
              const isSelected = row.original.path === selectedPath;

              return (
                <Table.Row
                  key={row.original.path}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-accent/10 hover:bg-accent/15'
                      : 'hover:bg-surface-secondary/70'
                  }`}
                  id={row.original.path}
                  textValue={row.original.name}
                >
                  {row.getVisibleCells().map((cell) => (
                    <Table.Cell
                      key={cell.id}
                      className={
                        cell.column.id === 'name' ? 'min-w-0' : undefined
                      }
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </Table.Cell>
                  ))}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
}
