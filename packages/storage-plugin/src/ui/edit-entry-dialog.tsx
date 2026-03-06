import { useEffect, useMemo, useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';

export type EditEntryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onEditEntry: (key: string, newValue: StorageEntryValue) => void;
  entry: StorageEntry | null;
  supportedTypes: StorageEntryType[];
};

export const EditEntryDialog = ({
  isOpen,
  onClose,
  onEditEntry,
  entry,
  supportedTypes,
}: EditEntryDialogProps) => {
  const [editValue, setEditValue] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'confirm' | 'alert';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });

  useEffect(() => {
    if (entry && isOpen) {
      setEditValue(Array.isArray(entry.value) ? JSON.stringify(entry.value) : String(entry.value));
    }
  }, [entry, isOpen]);

  const isTypeSupported = useMemo(
    () => !!entry && supportedTypes.includes(entry.type),
    [entry, supportedTypes]
  );

  const resetForm = () => {
    setEditValue('');
    onClose();
  };

  const handleEditEntry = () => {
    if (!entry) return;

    if (!isTypeSupported) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsupported Type',
        message: 'This storage does not support the current entry type.',
        type: 'alert',
      });
      return;
    }

    let newValue: StorageEntryValue;

    try {
      switch (entry.type) {
        case 'string':
          newValue = editValue;
          break;
        case 'number':
          newValue = Number(editValue);
          if (Number.isNaN(newValue)) {
            throw new Error('Invalid number');
          }
          break;
        case 'boolean':
          if (editValue !== 'true' && editValue !== 'false') {
            throw new Error('Boolean value must be "true" or "false"');
          }
          newValue = editValue === 'true';
          break;
        case 'buffer':
          newValue = JSON.parse(editValue);
          if (!Array.isArray(newValue) || !newValue.every((v) => typeof v === 'number')) {
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

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      resetForm();
    } else if (event.key === 'Enter' && editValue.trim()) {
      handleEditEntry();
    }
  };

  const getInputType = (type: StorageEntryType) => {
    if (type === 'number') {
      return 'number';
    }

    return 'text';
  };

  const getPlaceholder = (type: StorageEntryType) => {
    if (type === 'string') {
      return 'Enter string value';
    }

    if (type === 'number') {
      return 'Enter number value';
    }

    if (type === 'boolean') {
      return 'Enter true or false';
    }

    return 'Enter array as JSON, e.g., [1, 2, 3]';
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

  if (!isOpen || !entry) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={resetForm}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-96 max-w-full mx-4"
        onClick={(event) => event.stopPropagation()}
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
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Key</label>
            <div className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 font-mono">
              {entry.key}
            </div>
            <p className="text-xs text-gray-400 mt-1">Key cannot be changed during editing</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Type</label>
            <div className="flex items-center">
              <span
                className={`px-2 py-1 text-xs font-medium rounded text-white ${getTypeColorClass(
                  entry.type
                )}`}
              >
                {entry.type}
              </span>
            </div>
            {!isTypeSupported ? (
              <p className="text-xs text-amber-400 mt-1">
                This storage does not support {entry.type} values.
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Type cannot be changed during editing</p>
            )}
          </div>

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
                onChange={(event) => setEditValue(event.target.value)}
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
                onChange={(event) => setEditValue(event.target.value)}
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

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={resetForm}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEditEntry}
            disabled={!editValue.trim() || !isTypeSupported}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((previous) => ({ ...previous, isOpen: false }))}
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
