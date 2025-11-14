import { X, Info } from 'lucide-react';
import { JSONTree } from 'react-json-tree';
import { MMKVEntry } from '../shared/types';

export type EntryDetailDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  entry: MMKVEntry | null;
};

const jsonTreeTheme = {
  base00: 'transparent',
  base01: '#374151', // bg-gray-700
  base02: '#4b5563', // bg-gray-600
  base03: '#6b7280', // text-gray-500
  base04: '#9ca3af', // text-gray-400
  base05: '#d1d5db', // text-gray-300
  base06: '#e5e7eb', // text-gray-200
  base07: '#f9fafb', // text-gray-100
  base08: '#ef4444', // text-red-500
  base09: '#f59e0b', // text-yellow-500
  base0A: '#10b981', // text-green-500
  base0B: '#3b82f6', // text-blue-500
  base0C: '#06b6d4', // text-cyan-500
  base0D: '#8b5cf6', // text-purple-500
  base0E: '#ec4899', // text-pink-500
  base0F: '#f97316', // text-orange-500
};

const isJsonString = (value: string): boolean => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
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

const formatValue = (entry: MMKVEntry) => {
  switch (entry.type) {
    case 'string':
      return (
        <span className="text-green-300 font-mono break-all">
          "{entry.value as string}"
        </span>
      );
    case 'number':
      return (
        <span className="text-blue-300 font-mono">{entry.value as number}</span>
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
      return (
        <span className="text-purple-300 font-mono">
          [{bufferArray.join(', ')}]
        </span>
      );
    }
    default:
      return <span className="text-gray-400">Unknown</span>;
  }
};

export const EntryDetailDialog = ({
  isOpen,
  onClose,
  entry,
}: EntryDetailDialogProps) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen || !entry) return null;

  const isStringValue = entry.type === 'string';
  const stringValue = entry.value as string;
  const isJson = isStringValue && isJsonString(stringValue);
  let parsedJson: unknown = null;

  if (isJson) {
    try {
      parsedJson = JSON.parse(stringValue);
    } catch {
      // Should not happen since we already checked, but handle gracefully
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-[90vw] max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-100">
              Entry Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 flex-1 overflow-auto">
          {/* Key Display */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Key
            </label>
            <div className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 font-mono break-all">
              {entry.key}
            </div>
          </div>

          {/* Type Display */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Type
            </label>
            <div className="flex items-center">
              <span
                className={`px-2 py-1 text-xs font-medium rounded text-white ${getTypeColorClass(
                  entry.type
                )}`}
              >
                {entry.type}
              </span>
            </div>
          </div>

          {/* Value Display */}
          <div className="flex-1 min-h-0 flex flex-col">
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Value
            </label>
            <div className="max-h-96 overflow-auto bg-gray-700 border border-gray-600 rounded p-3">
              {isJson && parsedJson !== null ? (
                <JSONTree
                  data={parsedJson}
                  theme={jsonTreeTheme}
                  invertTheme={false}
                  shouldExpandNodeInitially={(keyPath) => keyPath.length <= 2}
                />
              ) : (
                <div className="text-sm">{formatValue(entry)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
