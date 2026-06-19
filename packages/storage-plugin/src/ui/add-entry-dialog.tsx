import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from '@rozenite/ui';
import { Plus } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { ConfirmDialog } from './confirm-dialog';
import { TypedValueEditor } from './typed-value-editor';
import { defaultValueForType } from './type-conversion';

type DialogState = {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'confirm' | 'alert';
  onConfirm?: () => void;
};

const EMPTY_DIALOG_STATE: DialogState = {
  isOpen: false,
  title: '',
  message: '',
  type: 'alert',
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

export type AddEntryDialogProps = {
  onAddEntry: (entry: StorageEntry) => void;
  existingKeys: string[];
  supportedTypes: StorageEntryType[];
  isDisabled?: boolean;
};

export const AddEntryDialog = ({
  onAddEntry,
  existingKeys,
  supportedTypes,
  isDisabled = false,
}: AddEntryDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newEntryKey, setNewEntryKey] = useState('');
  const [confirmDialog, setConfirmDialog] =
    useState<DialogState>(EMPTY_DIALOG_STATE);

  const initialType = useMemo<StorageEntryType>(
    () =>
      supportedTypes.includes('string')
        ? 'string'
        : (supportedTypes[0] ?? 'string'),
    [supportedTypes],
  );

  const [currentType, setCurrentType] = useState<StorageEntryType>(initialType);
  const [currentValue, setCurrentValue] = useState<StorageEntryValue | null>(
    defaultValueForType(initialType),
  );

  const isCurrentTypeSupported = supportedTypes.includes(currentType);

  // Reset state every time the dialog opens, so a previous session's
  // type / value doesn't bleed in.
  useEffect(() => {
    if (isOpen) {
      setNewEntryKey('');
      setCurrentType(initialType);
      setCurrentValue(defaultValueForType(initialType));
      setConfirmDialog(EMPTY_DIALOG_STATE);
    }
  }, [isOpen, initialType]);

  useEffect(() => {
    if (isDisabled && isOpen) {
      setIsOpen(false);
    }
  }, [isDisabled, isOpen]);

  const resetForm = () => {
    setNewEntryKey('');
    setCurrentType(initialType);
    setCurrentValue(defaultValueForType(initialType));
    setConfirmDialog(EMPTY_DIALOG_STATE);
  };

  const closeDialog = () => {
    resetForm();
    setIsOpen(false);
  };

  const handleAddEntry = () => {
    if (!newEntryKey.trim() || currentValue === null) {
      return;
    }

    if (!isCurrentTypeSupported) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsupported Type',
        message: 'Selected type is not supported by this storage.',
        type: 'alert',
      });
      return;
    }

    if (existingKeys.includes(newEntryKey)) {
      setConfirmDialog({
        isOpen: true,
        title: 'Key Already Exists',
        message: 'An entry with this key already exists.',
        type: 'alert',
      });
      return;
    }

    onAddEntry(buildEntry(newEntryKey, currentType, currentValue));
    closeDialog();
  };

  // Unsavable when no key, no supported type, or when the value is
  // null — the hex editor signals invalid / empty hex via null.
  const isAddDisabled =
    !newEntryKey.trim() || !isCurrentTypeSupported || currentValue === null;

  return (
    <>
      <Button isDisabled={isDisabled} onPress={() => setIsOpen(true)}>
        <Plus className="h-3 w-3" />
        Add Entry
      </Button>

      <Modal
        isOpen={isOpen}
        onOpenChange={(nextOpen) => {
          setIsOpen(nextOpen);
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center">
            <Modal.Dialog aria-label="Add New Entry">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>Add New Entry</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4 p-6">
                <TextField className="w-full" name="new-entry-key" type="text">
                  <Label>Key</Label>
                  <Input
                    autoFocus
                    onChange={(event) => setNewEntryKey(event.target.value)}
                    placeholder="Enter key name"
                    value={newEntryKey}
                    variant="secondary"
                  />
                </TextField>

                <div className="flex flex-col gap-2">
                  <Label>Value</Label>
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
                  {!isCurrentTypeSupported ? (
                    <Description className="text-xs text-warning">
                      Selected type is not supported by this storage.
                    </Description>
                  ) : null}
                </div>
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button onPress={closeDialog} variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={isAddDisabled}
                  onPress={handleAddEntry}
                  variant="primary"
                >
                  Add Entry
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <ConfirmDialog
        confirmText="OK"
        isOpen={confirmDialog.isOpen}
        message={confirmDialog.message}
        onClose={() =>
          setConfirmDialog((previous) => ({ ...previous, isOpen: false }))
        }
        onConfirm={() => {
          if (confirmDialog.onConfirm) {
            confirmDialog.onConfirm();
          }
        }}
        title={confirmDialog.title}
        type={confirmDialog.type}
      />
    </>
  );
};
