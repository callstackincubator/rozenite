import { Button, ConfirmDialog, Dialog, Field, Input } from '@rozenite/ui';
import { useEffect, useState } from 'react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
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
  const [alert, setAlert] = useState<{ title: string; message: string } | null>(
    null,
  );

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
      setAlert({
        title: 'Unsupported Type',
        message: 'Selected type is not supported by this storage.',
      });
      return;
    }

    if (existingKeys.includes(newEntryKey)) {
      setAlert({
        title: 'Key Already Exists',
        message: 'An entry with this key already exists.',
      });
      return;
    }

    onAddEntry(buildEntry(newEntryKey, currentType, currentValue));
    resetAndClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      newEntryKey.trim() &&
      currentType !== 'buffer'
    ) {
      handleAdd();
    }
  };

  // Unsavable when no key, no supported type, or when the value is
  // null — the hex editor signals invalid / empty hex via null.
  const isAddDisabled =
    !newEntryKey.trim() || !isCurrentTypeSupported || currentValue === null;

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) resetAndClose();
        }}
      >
        <Dialog.Content onKeyDown={handleKeyDown}>
          <Dialog.Header>
            <Dialog.Title>Add New Entry</Dialog.Title>
          </Dialog.Header>

          <div className="flex flex-col gap-4">
            <Field>
              <Field.Label htmlFor="new-entry-key">Key</Field.Label>
              <Input
                id="new-entry-key"
                value={newEntryKey}
                onChange={(event) => setNewEntryKey(event.target.value)}
                placeholder="Enter key name"
                autoFocus
              />
            </Field>

            <Field>
              <Field.Label htmlFor="new-entry-value">Value</Field.Label>
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
                <Field.Description className="text-destructive">
                  Selected type is not supported by this storage.
                </Field.Description>
              )}
            </Field>
          </div>

          <Dialog.Footer>
            <Button variant="outline" onClick={resetAndClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isAddDisabled}>
              Add Entry
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>

      <ConfirmDialog
        open={alert !== null}
        onOpenChange={(open) => {
          if (!open) setAlert(null);
        }}
        variant="alert"
        title={alert?.title ?? ''}
        description={alert?.message}
      />
    </>
  );
};
