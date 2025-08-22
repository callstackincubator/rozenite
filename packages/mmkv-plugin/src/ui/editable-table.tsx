import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Trash2, Loader2, Edit3 } from 'lucide-react';
import { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import { EditEntryDialog } from './edit-entry-dialog';
import { ConfirmDialog } from './confirm-dialog';

export type EditableTableProps = {
  data: MMKVEntry[];
  onValueChange?: (key: string, newValue: MMKVEntryValue) => void;
  onDeleteEntry?: (key: string) => void;
  loading?: boolean;
};

const columnHelper = createColumnHelper<MMKVEntry>();

export const EditableTable = ({
  data,
  onValueChange,
  onDeleteEntry,
  loading = false,
}: EditableTableProps) => {
  const [editingEntry, setEditingEntry] = useState<MMKVEntry | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryKey: string;
  }>({ isOpen: false, entryKey: '' });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<MMKVEntry, any>[]>(
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
          const type = getValue() as MMKVEntryType;
          return (
            <div className="flex items-center">
              <span
                className={`px-2 py-1 text-xs font-medium rounded text-white ${getTypeColorClass(
                  type
                )}`}
                title={`${getTypeIcon(type)} ${type}`}
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
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleEdit = (entry: MMKVEntry) => {
    setEditingEntry(entry);
    setShowEditDialog(true);
  };

  const handleEditEntry = (key: string, newValue: MMKVEntryValue) => {
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

  const getTypeColorClass = (type: string) => {
    switch (type) {
      case 'string':
        return 'bg-green-600';
      case 'number':
        return 'bg-blue-600';
      case 'boolean':
        return 'bg-yellow-600';
      case 'buffer':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string':
        return '📝';
      case 'number':
        return '🔢';
      case 'boolean':
        return '✅';
      case 'buffer':
        return '💾';
      default:
        return '❓';
    }
  };

  const formatValue = (entry: MMKVEntry) => {
    switch (entry.type) {
      case 'string':
        return (
          <span className="text-green-300 font-mono">
            "{entry.value as string}"
          </span>
        );
      case 'number':
        return (
          <span className="text-blue-300 font-mono">
            {entry.value as number}
          </span>
        );
      case 'boolean':
        return (
          <span
            className={`font-mono ${
              entry.value ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {entry.value ? 'true' : 'false'}
          </span>
        );
      case 'buffer': {
        const bufferArray = entry.value as number[];
        const displayValue =
          bufferArray.length > 5
            ? `[${bufferArray.slice(0, 5).join(', ')}, ...${
                bufferArray.length - 5
              } more]`
            : `[${bufferArray.join(', ')}]`;
        return (
          <span className="text-purple-300 font-mono">{displayValue}</span>
        );
      }
      default:
        return <span className="text-gray-400">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Loader2 className="h-8 w-8 text-blue-400 animate-spin mb-4" />
        <p className="text-gray-400">Loading entries...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full">
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
              className="text-sm hover:bg-gray-800 border-b border-gray-800"
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
    </div>
  );
};
