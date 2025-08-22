import { useState, useMemo, useRef, useEffect } from 'react';
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
import { Trash2, Loader2 } from 'lucide-react';
import { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';

interface EditableTableProps {
  data: MMKVEntry[];
  onValueChange?: (key: string, newValue: MMKVEntryValue) => void;
  onDeleteEntry?: (key: string) => void;
  loading?: boolean;
}

const columnHelper = createColumnHelper<MMKVEntry>();

export function EditableTable({
  data,
  onValueChange,
  onDeleteEntry,
  loading = false,
}: EditableTableProps) {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<number>(0);

  // Preserve cursor position on re-renders
  useEffect(() => {
    if (inputRef.current && editingCell) {
      const input = inputRef.current;
      const position = Math.min(cursorPositionRef.current, input.value.length);
      input.setSelectionRange(position, position);
    }
  }, [editValue, editingCell]);

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
        cell: ({ getValue, row, column }) => {
          const value = getValue();
          const entry = row.original;
          const isEditing =
            editingCell?.rowIndex === row.index &&
            editingCell?.columnId === column.id;

          if (isEditing) {
            return (
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type={getInputType(entry.type)}
                  value={editValue}
                  onChange={(e) => {
                    cursorPositionRef.current = e.target.selectionStart || 0;
                    setEditValue(e.target.value);
                  }}
                  onSelect={(e) => {
                    cursorPositionRef.current =
                      e.currentTarget.selectionStart || 0;
                  }}
                  onBlur={() => handleSave(row.original.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave(row.original.key);
                    } else if (e.key === 'Escape') {
                      setEditingCell(null);
                    }
                  }}
                  autoFocus
                  className="w-full px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={`Edit value for ${row.original.key}`}
                  placeholder="Enter new value"
                />
              </div>
            );
          }

          return (
            <div
              className="cursor-pointer hover:bg-gray-800 p-1 rounded transition-colors"
              onClick={() => handleEdit(row.index, column.id, value)}
            >
              {formatValue(entry)}
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
    [editingCell, editValue, onDeleteEntry]
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (rowIndex: number, columnId: string, value: any) => {
    setEditingCell({ rowIndex, columnId });

    // Handle different value types for editing
    let valueToEdit: string;
    if (Array.isArray(value)) {
      // For buffer values, show as JSON
      valueToEdit = JSON.stringify(value);
    } else {
      valueToEdit = String(value);
    }

    setEditValue(valueToEdit);
    // Reset cursor position to end of value when starting edit
    cursorPositionRef.current = valueToEdit.length;
  };

  const handleSave = (key: string) => {
    if (onValueChange && editingCell) {
      const entry = data[editingCell.rowIndex];
      let newValue: MMKVEntryValue;

      try {
        switch (entry.type) {
          case 'string':
            newValue = editValue;
            break;
          case 'number':
            newValue = Number(editValue);
            if (isNaN(newValue as number)) throw new Error('Invalid number');
            break;
          case 'boolean':
            newValue = editValue.toLowerCase() === 'true';
            break;
          case 'buffer':
            // For buffer, parse as JSON array of numbers
            try {
              newValue = JSON.parse(editValue);
              if (
                !Array.isArray(newValue) ||
                !newValue.every((v) => typeof v === 'number')
              ) {
                throw new Error('Buffer must be an array of numbers');
              }
            } catch {
              throw new Error(
                'Invalid buffer format. Use JSON array like [1,2,3]'
              );
            }
            break;
          default:
            newValue = editValue;
        }

        onValueChange(key, newValue);
      } catch (error) {
        console.error('Invalid value:', error);
        // Reset to original value on error
        setEditValue(String(entry.value));
      }
    }
    setEditingCell(null);
  };

  const handleDelete = (key: string) => {
    if (onDeleteEntry) {
      const confirmed = window.confirm(
        `Are you sure you want to delete the entry "${key}"?`
      );
      if (confirmed) {
        onDeleteEntry(key);
      }
    }
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

  const getInputType = (type: string) => {
    switch (type) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'text'; // We'll handle boolean conversion manually
      default:
        return 'text';
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
    </div>
  );
}
