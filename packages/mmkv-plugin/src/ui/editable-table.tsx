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
import { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import './editable-table.css';

interface EditableTableProps {
  data: MMKVEntry[];
  onValueChange?: (key: string, newValue: MMKVEntryValue) => void;
  loading?: boolean;
}

const columnHelper = createColumnHelper<MMKVEntry>();

export function EditableTable({
  data,
  onValueChange,
  loading = false,
}: EditableTableProps) {
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    columnId: string;
  } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<MMKVEntry, any>[]>(
    () => [
      columnHelper.accessor('key', {
        header: 'Key',
        enableSorting: true,
        cell: ({ getValue }) => (
          <div className="cell-key">
            <code>{getValue()}</code>
          </div>
        ),
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        enableSorting: true,
        cell: ({ getValue }) => {
          const type = getValue() as MMKVEntryType;
          return (
            <div className="cell-type">
              <span
                className="type-badge"
                style={{ backgroundColor: getTypeColor(type) }}
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
              <div className="cell-editing">
                <input
                  type={getInputType(entry.type)}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleSave(row.original.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSave(row.original.key);
                    } else if (e.key === 'Escape') {
                      setEditingCell(null);
                    }
                  }}
                  autoFocus
                  className="edit-input"
                  aria-label={`Edit value for ${row.original.key}`}
                  placeholder="Enter new value"
                />
              </div>
            );
          }

          return (
            <div
              className="cell-value"
              onClick={() => handleEdit(row.index, column.id, value)}
            >
              {formatValue(entry)}
            </div>
          );
        },
      }),
    ],
    [editingCell, editValue]
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

  const handleEdit = (rowIndex: number, columnId: string, value: any) => {
    setEditingCell({ rowIndex, columnId });
    setEditValue(String(value));
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
            newValue = editValue;
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string':
        return '#10b981';
      case 'number':
        return '#3b82f6';
      case 'boolean':
        return '#f59e0b';
      case 'buffer':
        return '#8b5cf6';
      default:
        return '#6b7280';
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
        return <span className="value-string">"{entry.value as string}"</span>;
      case 'number':
        return <span className="value-number">{entry.value as number}</span>;
      case 'boolean':
        return (
          <span className={`value-boolean ${entry.value ? 'true' : 'false'}`}>
            {entry.value ? 'true' : 'false'}
          </span>
        );
      case 'buffer':
        return (
          <span className="value-buffer">
            [Buffer: {(entry.value as string).substring(0, 20)}...]
          </span>
        );
      default:
        return <span className="value-unknown">Unknown</span>;
    }
  };

  if (loading) {
    return (
      <div className="table-loading">
        <div className="loading-spinner"></div>
        <p>Loading entries...</p>
      </div>
    );
  }

  return (
    <div className="editable-table-container">
      <table className="editable-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className={`table-header ${
                    header.column.getCanSort() ? 'sortable' : ''
                  }`}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="header-content">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    {header.column.getCanSort() && (
                      <span className="sort-indicator">
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? ' ↕️'}
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
            <tr key={row.id} className="table-row">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="table-cell">
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
