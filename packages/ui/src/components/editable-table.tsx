import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button, Chip } from '@heroui/react';
import { Edit3, Inbox, Loader2, Trash2 } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';
import { DataTable } from './data-table';

export type EditableTableChipColor =
  | 'success'
  | 'danger'
  | 'warning'
  | 'accent'
  | 'default';

export type EditableTableEntry = {
  key: string;
  type: string;
  value: unknown;
};

export type EditableTableProps<T extends EditableTableEntry> = {
  data: T[];
  ariaLabel: string;
  /** Message shown when there are no rows (callers make it search-aware). */
  emptyMessage: string;
  loading?: boolean;
  /** Maps an entry type to a Chip color. */
  typeColor?: (type: T['type']) => EditableTableChipColor;
  /** Renders the value cell. Buffer formatting differs per plugin. */
  renderValue: (entry: T) => ReactNode;
  onRowClick?: (entry: T) => void;
  onDeleteEntry?: (key: string) => void;
  /** Renders the plugin's own edit dialog, wired to the row being edited. */
  renderEditDialog?: (args: {
    entry: T | null;
    onClose: () => void;
  }) => ReactNode;
};

const DEFAULT_TYPE_COLOR: Record<string, EditableTableChipColor> = {
  string: 'success',
  number: 'default',
  boolean: 'warning',
  buffer: 'accent',
};

const defaultTypeColor = (type: string): EditableTableChipColor =>
  DEFAULT_TYPE_COLOR[type] ?? 'default';

export const EditableTable = <T extends EditableTableEntry>({
  data,
  ariaLabel,
  emptyMessage,
  loading = false,
  typeColor = defaultTypeColor,
  renderValue,
  onRowClick,
  onDeleteEntry,
  renderEditDialog,
}: EditableTableProps<T>) => {
  const [editingEntry, setEditingEntry] = useState<T | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryKey: string;
  }>({ isOpen: false, entryKey: '' });

  const handleDelete = (key: string) => {
    if (onDeleteEntry) {
      setDeleteConfirm({ isOpen: true, entryKey: key });
    }
  };

  const confirmDelete = () => {
    if (onDeleteEntry && deleteConfirm.isOpen) {
      onDeleteEntry(deleteConfirm.entryKey);
    }

    setDeleteConfirm({ isOpen: false, entryKey: '' });
  };

  const columns = useMemo<ColumnDef<T>[]>(
    () => [
      {
        id: 'key',
        accessorFn: (row) => row.key,
        header: 'Key',
        enableSorting: true,
        cell: ({ row }) => (
          <span className="font-mono text-sm text-foreground">
            {row.original.key}
          </span>
        ),
      },
      {
        id: 'type',
        accessorFn: (row) => row.type,
        header: 'Type',
        enableSorting: true,
        cell: ({ row }) => (
          <Chip color={typeColor(row.original.type)} size="sm" variant="soft">
            {row.original.type}
          </Chip>
        ),
      },
      {
        id: 'value',
        accessorFn: (row) => row.value,
        header: 'Value',
        meta: { cellClassName: 'min-w-0' },
        cell: ({ row }) => (
          <div className="min-w-0">{renderValue(row.original)}</div>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              aria-label={`Edit value for ${row.original.key}`}
              isDisabled={!renderEditDialog}
              isIconOnly
              onClick={(event) => event.stopPropagation()}
              onPress={() => setEditingEntry(row.original)}
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
      },
    ],
    // handleDelete only depends on stable setState + onDeleteEntry.
    [typeColor, renderValue, onDeleteEntry, renderEditDialog],
  );

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
      <DataTable
        ariaLabel={ariaLabel}
        className="w-full border border-border/70 bg-surface shadow-sm"
        columns={columns}
        data={data}
        getRowId={(entry) => entry.key}
        onRowClick={onRowClick}
        renderEmptyState={() => (
          <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-4 py-10 text-center">
            <Inbox className="size-6 text-muted" />
            <span className="text-sm text-muted">{emptyMessage}</span>
          </div>
        )}
        scrollClassName="w-full"
      />

      {renderEditDialog?.({
        entry: editingEntry,
        onClose: () => setEditingEntry(null),
      })}

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
