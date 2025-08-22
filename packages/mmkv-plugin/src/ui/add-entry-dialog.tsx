import { useState } from 'react';
import { X } from 'lucide-react';
import { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';

export type AddEntryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddEntry: (entry: MMKVEntry) => void;
  existingKeys: string[];
};

export const AddEntryDialog = ({
  isOpen,
  onClose,
  onAddEntry,
  existingKeys,
}: AddEntryDialogProps) => {
  const [newEntryKey, setNewEntryKey] = useState('');
  const [newEntryType, setNewEntryType] = useState<MMKVEntryType>('string');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  const resetForm = () => {
    setNewEntryKey('');
    setNewEntryType('string');
    setNewEntryValue('');
    onClose();
  };

  const handleAddEntry = () => {
    if (!newEntryKey.trim()) return;

    // Check if key already exists
    if (existingKeys.includes(newEntryKey)) {
      setConfirmDialog({
        isOpen: true,
        title: 'Key Already Exists',
        message: 'An entry with this key already exists!',
        type: 'alert',
      });
      return;
    }

    // Parse the value based on type
    let parsedValue: MMKVEntryValue;
    try {
      switch (newEntryType) {
        case 'string':
          parsedValue = newEntryValue;
          break;
        case 'number':
          parsedValue = Number(newEntryValue);
          if (isNaN(parsedValue as number)) {
            throw new Error('Invalid number');
          }
          break;
        case 'boolean':
          parsedValue = newEntryValue.toLowerCase() === 'true';
          break;
        case 'buffer':
          parsedValue = JSON.parse(newEntryValue);
          if (
            !Array.isArray(parsedValue) ||
            !parsedValue.every((v) => typeof v === 'number')
          ) {
            throw new Error('Buffer must be an array of numbers');
          }
          break;
        default:
          throw new Error('Invalid type');
      }
    } catch (error) {
      setConfirmDialog({
        isOpen: true,
        title: 'Invalid Value',
        message: `Invalid value for ${newEntryType}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        type: 'alert',
      });
      return;
    }

    const newEntry: MMKVEntry = {
      key: newEntryKey,
      type: newEntryType,
      value: parsedValue,
    } as MMKVEntry;

    onAddEntry(newEntry);

    // Reset form and close dialog
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      resetForm();
    } else if (
      e.key === 'Enter' &&
      newEntryKey.trim() &&
      newEntryValue.trim()
    ) {
      handleAddEntry();
    }
  };

  if (!isOpen) return null;

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
          <h2 className="text-lg font-semibold text-gray-100">Add New Entry</h2>
          <button
            onClick={resetForm}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Key Input */}
          <div>
            <label
              htmlFor="new-entry-key"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Key
            </label>
            <input
              id="new-entry-key"
              type="text"
              value={newEntryKey}
              onChange={(e) => setNewEntryKey(e.target.value)}
              placeholder="Enter key name"
              className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Type Select */}
          <div>
            <label
              htmlFor="new-entry-type"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Type
            </label>
            <select
              id="new-entry-type"
              value={newEntryType}
              onChange={(e) => {
                setNewEntryType(e.target.value as MMKVEntryType);
                setNewEntryValue(''); // Reset value when type changes
              }}
              className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="buffer">Buffer (Array)</option>
            </select>
          </div>

          {/* Value Input */}
          <div>
            <label
              htmlFor="new-entry-value"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Value
            </label>
            {newEntryType === 'boolean' ? (
              <select
                id="new-entry-value"
                value={newEntryValue}
                onChange={(e) => setNewEntryValue(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select value</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                id="new-entry-value"
                type={newEntryType === 'number' ? 'number' : 'text'}
                value={newEntryValue}
                onChange={(e) => setNewEntryValue(e.target.value)}
                placeholder={
                  newEntryType === 'string'
                    ? 'Enter string value'
                    : newEntryType === 'number'
                    ? 'Enter number value'
                    : newEntryType === 'buffer'
                    ? 'Enter array as JSON, e.g., [1, 2, 3]'
                    : 'Enter value'
                }
                className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            {newEntryType === 'buffer' && (
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
            onClick={handleAddEntry}
            disabled={!newEntryKey.trim() || !newEntryValue.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Add Entry
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
