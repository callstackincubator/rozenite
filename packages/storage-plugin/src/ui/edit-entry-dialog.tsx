import { Button, Dialog, Field, useConfirmDialog } from '@rozenite/ui';
import { useEffect, useRef, useState } from 'react';
import type { StorageEntry, StorageEntryType, StorageEntryValue } from '../shared/types';
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
  const lastEntryRef = useRef<StorageEntry | null>(entry);
  const [currentType, setCurrentType] = useState<StorageEntryType>('string');
  const [currentValue, setCurrentValue] = useState<StorageEntryValue | null>(
    defaultValueForType('string'),
  );
  const confirm = useConfirmDialog();

  useEffect(() => {
    if (entry && isOpen) {
      lastEntryRef.current = entry;
      setCurrentType(entry.type);
      setCurrentValue(entry.value);
    }
  }, [entry, isOpen]);

  const entryForDisplay = entry ?? lastEntryRef.current;

  const isCurrentTypeSupported = supportedTypes.includes(currentType);

  const resetAndClose = () => {
    setCurrentType('string');
    setCurrentValue(defaultValueForType('string'));
    onClose();
  };

  const handleSave = async () => {
    if (!entry || currentValue === null) return;

    if (!isCurrentTypeSupported) {
      await confirm({
        variant: 'alert',
        title: 'Unsupported Type',
        description: 'This storage does not support the selected type.',
      });
      return;
    }

    onEditEntry(entry.key, currentValue);
    resetAndClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && currentType !== 'buffer') {
      void handleSave();
    }
  };

  if (!entryForDisplay) {
    return null;
  }

  // Unsavable when the type isn't supported, or when the current value
  // is null (the hex editor signals invalid / empty hex as null —
  // empty bytes are not a meaningful entry to save).
  const isSaveDisabled = !isCurrentTypeSupported || currentValue === null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) resetAndClose();
      }}
    >
      <Dialog.Content onKeyDown={handleKeyDown}>
        <Dialog.Header>
          <Dialog.Title>Edit Entry</Dialog.Title>
        </Dialog.Header>

        <div className="flex flex-col gap-4">
          <Field>
            <Field.Label>Key</Field.Label>
            <div className="h-8 w-full truncate rounded-md border border-input bg-muted px-3 py-1.5 font-mono text-sm text-foreground">
              {entryForDisplay.key}
            </div>
            <Field.Description>Key cannot be changed during editing</Field.Description>
          </Field>

          <Field>
            <Field.Label htmlFor="edit-entry-value">Value</Field.Label>
            <TypedValueEditor
              key={entryForDisplay.key}
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
              <Field.Description className="text-danger">
                This storage does not support {currentType} values.
              </Field.Description>
            )}
          </Field>
        </div>

        <Dialog.Footer>
          <Button tone="neutral" variant="outline" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={isSaveDisabled}>
            Save Changes
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
