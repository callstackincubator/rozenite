import { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';
import { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';

export type EditEntryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onEditEntry: (key: string, newValue: MMKVEntryValue) => void;
  entry: MMKVEntry | null;
};

export const EditEntryDialog = ({
  isOpen,
  onClose,
  onEditEntry,
  entry,
}: EditEntryDialogProps) => {
  const [editValue, setEditValue] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  // Reset form when entry changes or dialog opens
  useEffect(() => {
    if (entry && isOpen) {
      // Handle different value types for editing
      let valueToEdit: string;
      if (Array.isArray(entry.value)) {
        // For buffer values, show as JSON
        valueToEdit = JSON.stringify(entry.value);
      } else {
        valueToEdit = String(entry.value);
      }
      setEditValue(valueToEdit);
    }
  }, [entry, isOpen]);

  const resetForm = () => {
    setEditValue('');
    onClose();
  };

  const handleEditEntry = () => {
    if (!entry) return;

    let newValue: MMKVEntryValue;

    try {
      switch (entry.type) {
        case 'string':
          newValue = editValue;
          break;
        case 'number':
          newValue = Number(editValue);
          if (isNaN(newValue as number)) {
            throw new Error('Invalid number');
          }
          break;
        case 'boolean':
          if (
            editValue.toLowerCase() !== 'true' &&
            editValue.toLowerCase() !== 'false'
          ) {
            throw new Error('Boolean value must be "true" or "false"');
          }
          newValue = editValue.toLowerCase() === 'true';
          break;
        case 'buffer':
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
          throw new Error('Invalid type');
      }
    } catch (error) {
      setConfirmDialog({
        isOpen: true,
        title: 'Invalid Value',
        message: `Invalid value for ${entry.type}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        type: 'alert',
      });
      return;
    }

    onEditEntry(entry.key, newValue);
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      resetForm();
    } else if (e.key === 'Enter' && editValue.trim()) {
      handleEditEntry();
    }
  };

  const getInputType = (type: MMKVEntryType) => {
    switch (type) {
      case 'number':
        return 'number';
      case 'boolean':
        return 'text'; // We'll handle boolean conversion manually
      default:
        return 'text';
    }
  };

  const getPlaceholder = (type: MMKVEntryType) => {
    switch (type) {
      case 'string':
        return 'Enter string value';
      case 'number':
        return 'Enter number value';
      case 'boolean':
        return 'Enter "true" or "false"';
      case 'buffer':
        return 'Enter array as JSON, e.g., [1, 2, 3]';
      default:
        return 'Enter value';
    }
  };

  const getTypeColorClass = (type: MMKVEntryType) => {
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

  if (!isOpen || !entry) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={resetForm}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-100">Edit Entry</h2>
          </div>
          <button
            onClick={resetForm}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Key Display */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">
              Key
            </label>
            <div className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 font-mono">
              {entry.key}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Key cannot be changed during editing
            </p>
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
            <p className="text-xs text-gray-400 mt-1">
              Type cannot be changed during editing
            </p>
          </div>

          {/* Value Input */}
          <div>
            <label
              htmlFor="edit-entry-value"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Value
            </label>
            {entry.type === 'boolean' ? (
              <select
                id="edit-entry-value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                id="edit-entry-value"
                type={getInputType(entry.type)}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={getPlaceholder(entry.type)}
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            )}
            {entry.type === 'buffer' && (
              <p className="text-xs text-gray-400 mt-1">
                Enter as JSON array of numbers, e.g., [1, 2, 3, 255]
              </p>
            )}
          </div>
        </div>

        {/* Dialog Actions */}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={resetForm}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEditEntry}
            disabled={!editValue.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
          }
        }}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type={confirmDialog.type}
      />
    </div>
  );
};
