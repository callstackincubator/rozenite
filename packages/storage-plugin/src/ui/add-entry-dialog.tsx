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

const TYPE_OPTIONS: Array<{ value: StorageEntryType; label: string }> = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'buffer', label: 'Buffer (Array)' },
];

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
  const [newEntryType, setNewEntryType] = useState<StorageEntryType>('string');
  const [newEntryValue, setNewEntryValue] = useState('');
  const [confirmDialog, setConfirmDialog] =
    useState<DialogState>(EMPTY_DIALOG_STATE);

  const enabledTypes = useMemo(
    () => TYPE_OPTIONS.filter((option) => supportedTypes.includes(option.value)),
    [supportedTypes],
  );
  const firstSupportedType = enabledTypes[0]?.value;
  const selectedTypeSupported = supportedTypes.includes(newEntryType);

  useEffect(() => {
    if (isOpen && !selectedTypeSupported && firstSupportedType) {
      setNewEntryType(firstSupportedType);
    }
  }, [firstSupportedType, isOpen, selectedTypeSupported]);

  useEffect(() => {
    if (isDisabled && isOpen) {
      setNewEntryKey('');
      setNewEntryType(firstSupportedType ?? 'string');
      setNewEntryValue('');
      setConfirmDialog(EMPTY_DIALOG_STATE);
      setIsOpen(false);
    }
  }, [firstSupportedType, isDisabled, isOpen]);

  const resetForm = () => {
    setNewEntryKey('');
    setNewEntryType(firstSupportedType ?? 'string');
    setNewEntryValue('');
    setConfirmDialog(EMPTY_DIALOG_STATE);
  };

  const closeDialog = () => {
    resetForm();
    setIsOpen(false);
  };

  const handleAddEntry = () => {
    if (!newEntryKey.trim()) {
      return;
    }

    if (!selectedTypeSupported) {
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

    let parsedValue: StorageEntryValue;
    try {
      switch (newEntryType) {
        case 'string':
          parsedValue = newEntryValue;
          break;
        case 'number':
          parsedValue = Number(newEntryValue);
          if (Number.isNaN(parsedValue)) {
            throw new Error('Invalid number');
          }
          break;
        case 'boolean':
          if (newEntryValue !== 'true' && newEntryValue !== 'false') {
            throw new Error('Boolean value must be true or false');
          }
          parsedValue = newEntryValue === 'true';
          break;
        case 'buffer':
          parsedValue = JSON.parse(newEntryValue);
          if (
            !Array.isArray(parsedValue) ||
            !parsedValue.every((value) => typeof value === 'number')
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

    let entry: StorageEntry;
    if (newEntryType === 'string') {
      entry = { key: newEntryKey, type: 'string', value: parsedValue as string };
    } else if (newEntryType === 'number') {
      entry = { key: newEntryKey, type: 'number', value: parsedValue as number };
    } else if (newEntryType === 'boolean') {
      entry = { key: newEntryKey, type: 'boolean', value: parsedValue as boolean };
    } else {
      entry = { key: newEntryKey, type: 'buffer', value: parsedValue as number[] };
    }

    onAddEntry(entry);
    closeDialog();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && newEntryKey.trim() && newEntryValue.trim()) {
      handleAddEntry();
    }
  };

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
                    onKeyDown={handleInputKeyDown}
                    placeholder="Enter key name"
                    value={newEntryKey}
                    variant="secondary"
                  />
                </TextField>

                <div className="flex flex-col gap-2">
                  <Label>Type</Label>
                  <Select
                    className="w-full"
                    onChange={(key) => {
                      setNewEntryType(
                        (key == null ? '' : String(key)) as StorageEntryType,
                      );
                      setNewEntryValue('');
                    }}
                    value={newEntryType || null}
                    variant="secondary"
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox aria-label="Entry type">
                        {TYPE_OPTIONS.map((option) => {
                          const isSupported = supportedTypes.includes(
                            option.value,
                          );

                          return (
                            <ListBox.Item
                              id={option.value}
                              isDisabled={!isSupported}
                              key={option.value}
                              textValue={option.label}
                            >
                              {isSupported
                                ? option.label
                                : `${option.label} (Not supported)`}
                            </ListBox.Item>
                          );
                        })}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {!selectedTypeSupported ? (
                    <Description className="text-xs text-warning">
                      Selected type is not supported by this storage.
                    </Description>
                  ) : null}
                </div>

                {newEntryType === 'boolean' ? (
                  <div className="flex flex-col gap-2">
                    <Label>Value</Label>
                    <Select
                      className="w-full"
                      onChange={(key) =>
                        setNewEntryValue(key == null ? '' : String(key))
                      }
                      placeholder="Select value"
                      value={newEntryValue || null}
                      variant="secondary"
                    >
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox aria-label="Entry value">
                          <ListBox.Item id="true" key="true" textValue="true">
                            true
                          </ListBox.Item>
                          <ListBox.Item
                            id="false"
                            key="false"
                            textValue="false"
                          >
                            false
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                ) : (
                  <TextField
                    className="w-full"
                    name="new-entry-value"
                    type={newEntryType === 'number' ? 'number' : 'text'}
                  >
                    <Label>Value</Label>
                    <Input
                      onChange={(event) => setNewEntryValue(event.target.value)}
                      onKeyDown={handleInputKeyDown}
                      placeholder={
                        newEntryType === 'string'
                          ? 'Enter string value'
                          : newEntryType === 'number'
                            ? 'Enter number value'
                            : newEntryType === 'buffer'
                              ? 'Enter array as JSON, e.g., [1, 2, 3]'
                              : 'Enter value'
                      }
                      value={newEntryValue}
                      variant="secondary"
                    />
                    {newEntryType === 'buffer' ? (
                      <Description className="text-xs text-muted">
                        Enter as JSON array of numbers, e.g., [1, 2, 3, 255]
                      </Description>
                    ) : null}
                  </TextField>
                )}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button onPress={closeDialog} variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={
                    !newEntryKey.trim() ||
                    !newEntryValue.trim() ||
                    !selectedTypeSupported
                  }
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
