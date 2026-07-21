import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  ConfirmDialog,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  TextField,
} from '@rozenite/ui';
import { Edit3 } from 'lucide-react';
import type { MMKVEntry, MMKVEntryType, MMKVEntryValue } from '../shared/types';

export type EditEntryDialogProps = {
  onClose: () => void;
  onEditEntry: (key: string, newValue: MMKVEntryValue) => void;
  entry: MMKVEntry | null;
};

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

const typeColorMap: Record<
  MMKVEntryType,
  'success' | 'warning' | 'accent' | 'default'
> = {
  string: 'success',
  number: 'default',
  boolean: 'warning',
  buffer: 'accent',
};

const getInputType = (type: MMKVEntryType) =>
  type === 'number' ? 'number' : 'text';

const getPlaceholder = (type: MMKVEntryType) => {
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

export const EditEntryDialog = ({
  onClose,
  onEditEntry,
  entry,
}: EditEntryDialogProps) => {
  const [editValue, setEditValue] = useState('');
  const [confirmDialog, setConfirmDialog] =
    useState<DialogState>(EMPTY_DIALOG_STATE);

  useEffect(() => {
    if (entry) {
      setEditValue(
        Array.isArray(entry.value)
          ? JSON.stringify(entry.value)
          : String(entry.value),
      );
      setConfirmDialog(EMPTY_DIALOG_STATE);
    }
  }, [entry]);

  const resetForm = () => {
    setEditValue('');
    setConfirmDialog(EMPTY_DIALOG_STATE);
    onClose();
  };

  const handleEditEntry = () => {
    if (!entry) {
      return;
    }

    let newValue: MMKVEntryValue;

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
          if (
            !Array.isArray(newValue) ||
            !newValue.every((value) => typeof value === 'number')
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

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && editValue.trim()) {
      handleEditEntry();
    }
  };

  return (
    <>
      <Modal
        isOpen={entry !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            resetForm();
          }
        }}
      >
        <Modal.Backdrop variant="blur">
          <Modal.Container placement="center">
            <Modal.Dialog aria-label="Edit Entry">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-info/15 text-info">
                  <Edit3 className="size-5" />
                </Modal.Icon>
                <Modal.Heading>Edit Entry</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4 p-6">
                {entry ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <Label>Key</Label>
                      <Surface
                        className="rounded-lg border border-border/70 bg-surface-secondary px-3 py-2 font-mono text-sm text-foreground"
                        variant="secondary"
                      >
                        {entry.key}
                      </Surface>
                      <Description className="text-xs text-muted">
                        Key cannot be changed during editing.
                      </Description>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label>Type</Label>
                      <Chip
                        className="w-fit"
                        color={typeColorMap[entry.type]}
                        size="sm"
                        variant="soft"
                      >
                        {entry.type}
                      </Chip>
                      <Description className="text-xs text-muted">
                        Type cannot be changed during editing.
                      </Description>
                    </div>

                    {entry.type === 'boolean' ? (
                      <div className="flex flex-col gap-2">
                        <Label>Value</Label>
                        <Select
                          className="w-full"
                          onChange={(key) =>
                            setEditValue(key == null ? '' : String(key))
                          }
                          value={editValue || null}
                          variant="secondary"
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox aria-label="Entry value">
                              <ListBox.Item
                                id="true"
                                key="true"
                                textValue="true"
                              >
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
                        name="edit-entry-value"
                        type={getInputType(entry.type)}
                      >
                        <Label>Value</Label>
                        <Input
                          autoFocus
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={handleInputKeyDown}
                          placeholder={getPlaceholder(entry.type)}
                          value={editValue}
                          variant="secondary"
                        />
                        {entry.type === 'buffer' ? (
                          <Description className="text-xs text-muted">
                            Enter as JSON array of numbers, e.g., [1, 2, 3, 255]
                          </Description>
                        ) : null}
                      </TextField>
                    )}
                  </>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button onPress={resetForm} variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={!editValue.trim()}
                  onPress={handleEditEntry}
                  variant="primary"
                >
                  Save Changes
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
