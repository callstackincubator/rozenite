import { useEffect, useState } from 'react';
import { X, Edit3 } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';
import { TypedValueEditor } from './typed-value-editor';
import { defaultValueForType } from './type-conversion';

export type EditEntryDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  // Called with the runtime value in its native JS shape — the caller
  // infers the storage type from `typeof newValue`. Lets the dialog
  // change the entry's stored type (e.g. string → buffer) without a
  // dedicated prop for the new type.
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
  const [currentType, setCurrentType] = useState<StorageEntryType>('string');
  const [currentValue, setCurrentValue] = useState<StorageEntryValue | null>(
    defaultValueForType('string'),
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({ isOpen: false, title: '', message: '' });

  useEffect(() => {
    if (entry && isOpen) {
      setCurrentType(entry.type);
      setCurrentValue(entry.value);
    }
  }, [entry, isOpen]);

  const isCurrentTypeSupported = supportedTypes.includes(currentType);

  const resetAndClose = () => {
    setCurrentType('string');
    setCurrentValue(defaultValueForType('string'));
    onClose();
  };

  const handleSave = () => {
    if (!entry || currentValue === null) return;

    if (!isCurrentTypeSupported) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsupported Type',
        message: 'This storage does not support the selected type.',
      });
      return;
    }

    onEditEntry(entry.key, currentValue);
    resetAndClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      resetAndClose();
      return;
    }
    if (event.key === 'Enter' && currentType !== 'buffer') {
      handleSave();
    }
  };

  if (!isOpen || !entry) {
    return null;
  }

  // Unsavable when the type isn't supported, or when the current value
  // is null (the hex editor signals invalid / empty hex as null —
  // empty bytes are not a meaningful entry to save).
  const isSaveDisabled = !isCurrentTypeSupported || currentValue === null;

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
          <div className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-100">Edit Entry</h2>
          </div>
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

          <div>
            <label
              htmlFor="edit-entry-value"
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
              inputId="edit-entry-value"
              autoFocus
            />
            {!isCurrentTypeSupported && (
              <p className="text-xs text-amber-400 mt-1">
                This storage does not support {currentType} values.
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
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
          >
            Save Changes
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
