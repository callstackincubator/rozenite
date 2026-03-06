import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Edit3, Loader2, Trash2 } from 'lucide-react';
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
};

const columnHelper = createColumnHelper<StorageEntry>();

export const EditableTable = ({
  data,
  supportedTypes,
  onValueChange,
  onDeleteEntry,
  onRowClick,
  loading = false,
}: EditableTableProps) => {
  const [editingEntry, setEditingEntry] = useState<StorageEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryKey: string;
  }>({ isOpen: false, entryKey: '' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<StorageEntry, any>[]>(
    () => [
      columnHelper.accessor('key', {
        header: 'Key',
        enableSorting: true,
        cell: ({ getValue }) => (
          <div className="text-gray-300 font-mono text-sm">{getValue()}</div>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        enableSorting: true,
        cell: ({ getValue }) => {
          const type = getValue() as StorageEntryType;
          return (
            <div className="flex items-center">
              <span
                className={`px-2 py-1 text-xs font-medium rounded text-white ${getTypeColorClass(
                  type
                )}`}
              >
                {type}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('value', {
        header: 'Value',
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div className="flex items-center justify-between group">
              <div className="flex-1">{formatValue(entry)}</div>
              <button
                onClick={() => handleEdit(entry)}
                className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-800 rounded transition-all"
                title="Edit value"
                aria-label={`Edit value for ${entry.key}`}
              >
                <Edit3 className="h-3 w-3" />
              </button>
            </div>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDelete(row.original.key)}
              disabled={!onDeleteEntry}
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Delete entry"
              aria-label={`Delete entry ${row.original.key}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      }),
    ],
    [onDeleteEntry]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleEdit = (entry: StorageEntry) => {
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleEditEntry = (key: string, newValue: StorageEntryValue) => {
    if (onValueChange) {
      onValueChange(key, newValue);
    }

    setEditingEntry(null);
    setShowEditDialog(false);
  };

  const handleCloseEditDialog = () => {
    setEditingEntry(null);
    setShowEditDialog(false);
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
      <div className="flex flex-col items-center justify-center h-full w-full">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading entries...</p>
      </div>
    );
  }

  return (
    <>
      <table className="w-full self-start">
        <thead className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`text-left text-xs font-medium text-gray-400 px-3 py-2 ${
                    header.column.getCanSort()
                      ? 'cursor-pointer select-none hover:bg-gray-700'
                      : ''
                  }`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanSort() && (
                      <span className="text-gray-500">
                        {{
                          asc: '↑',
                          desc: '↓',
                        }[header.column.getIsSorted() as string] ?? '↕'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className={`text-sm hover:bg-gray-800 border-b border-gray-800 ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (
                  target.tagName === 'BUTTON' ||
                  target.closest('button') ||
                  target.tagName === 'INPUT' ||
                  target.closest('input')
                ) {
                  return;
                }

                if (onRowClick) {
                  onRowClick(row.original);
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <EditEntryDialog
        isOpen={showEditDialog}
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

const getTypeColorClass = (type: StorageEntryType) => {
  if (type === 'string') {
    return 'bg-green-600';
  }

  if (type === 'number') {
    return 'bg-blue-600';
  }

  if (type === 'boolean') {
    return 'bg-yellow-600';
  }

  return 'bg-purple-600';
};

const formatValue = (entry: StorageEntry) => {
  if (entry.type === 'string') {
    return <span className="text-green-300 font-mono">"{entry.value}"</span>;
  }

  if (entry.type === 'number') {
    return <span className="text-blue-300 font-mono">{entry.value}</span>;
  }

  if (entry.type === 'boolean') {
    return (
      <span className={`font-mono ${entry.value ? 'text-green-400' : 'text-red-400'}`}>
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  const displayValue =
    entry.value.length > 5
      ? `[${entry.value.slice(0, 5).join(', ')}, ...${entry.value.length - 5} more]`
      : `[${entry.value.join(', ')}]`;

  return <span className="text-purple-300 font-mono">{displayValue}</span>;
};
