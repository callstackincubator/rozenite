import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';
import { TypedValueEditor } from './typed-value-editor';
import { defaultValueForType } from './type-conversion';

export type AddEntryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onAddEntry: (entry: StorageEntry) => void;
  existingKeys: string[];
  supportedTypes: StorageEntryType[];
};

const buildEntry = (
  key: string,
  type: StorageEntryType,
  value: StorageEntryValue,
): StorageEntry => {
  switch (type) {
    case 'string':
      return { key, type: 'string', value: value as string };
    case 'number':
      return { key, type: 'number', value: value as number };
    case 'boolean':
      return { key, type: 'boolean', value: value as boolean };
    case 'buffer':
      return { key, type: 'buffer', value: value as number[] };
  }
};

export const AddEntryDialog = ({
  isOpen,
  onClose,
  onAddEntry,
  existingKeys,
  supportedTypes,
}: AddEntryDialogProps) => {
  const initialType: StorageEntryType = supportedTypes.includes('string')
    ? 'string'
    : (supportedTypes[0] ?? 'string');

  const [newEntryKey, setNewEntryKey] = useState('');
  const [currentType, setCurrentType] = useState<StorageEntryType>(initialType);
  const [currentValue, setCurrentValue] = useState<StorageEntryValue | null>(
    defaultValueForType(initialType),
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  // Reset state every time the dialog opens, so a previous session's
  // type / value doesn't bleed in.
  useEffect(() => {
    if (isOpen) {
      setNewEntryKey('');
      setCurrentType(initialType);
      setCurrentValue(defaultValueForType(initialType));
    }
  }, [isOpen, initialType]);

  const isCurrentTypeSupported = supportedTypes.includes(currentType);

  const resetAndClose = () => {
    setNewEntryKey('');
    setCurrentType(initialType);
    setCurrentValue(defaultValueForType(initialType));
    onClose();
  };

  const handleAdd = () => {
    if (!newEntryKey.trim() || currentValue === null) return;

    if (!isCurrentTypeSupported) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsupported Type',
        message: 'Selected type is not supported by this storage.',
      });
      return;
    }

    if (existingKeys.includes(newEntryKey)) {
      setConfirmDialog({
        isOpen: true,
        title: 'Key Already Exists',
        message: 'An entry with this key already exists.',
      });
      return;
    }

    onAddEntry(buildEntry(newEntryKey, currentType, currentValue));
    resetAndClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      resetAndClose();
      return;
    }
    if (
      event.key === 'Enter' &&
      newEntryKey.trim() &&
      currentType !== 'buffer'
    ) {
      handleAdd();
    }
  };

  if (!isOpen) {
    return null;
  }

  // Unsavable when no key, no supported type, or when the value is
  // null — the hex editor signals invalid / empty hex via null.
  const isAddDisabled =
    !newEntryKey.trim() || !isCurrentTypeSupported || currentValue === null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={resetAndClose}
    >
      <div
        className="bg-gray-800 rounded-lg p-6 w-[32rem] max-w-full mx-4"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Add New Entry</h2>
          <button
            onClick={resetAndClose}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded transition-colors"
            title="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
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
              onChange={(event) => setNewEntryKey(event.target.value)}
              placeholder="Enter key name"
              className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="new-entry-value"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Value
            </label>
            <TypedValueEditor
              supportedTypes={supportedTypes}
              type={currentType}
              value={currentValue}
              onChange={(nextType, nextValue) => {
                setCurrentType(nextType);
                setCurrentValue(nextValue);
              }}
              inputId="new-entry-value"
            />
            {!isCurrentTypeSupported && (
              <p className="text-xs text-amber-400 mt-1">
                Selected type is not supported by this storage.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={resetAndClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={isAddDisabled}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Add Entry
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() =>
          setConfirmDialog((previous) => ({ ...previous, isOpen: false }))
        }
        onConfirm={() => {}}
        title={confirmDialog.title}
        message={confirmDialog.message}
        type="alert"
      />
    </div>
  );
};
