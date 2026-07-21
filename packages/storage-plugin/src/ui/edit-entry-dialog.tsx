import { useEffect, useState } from 'react';
import {
  Button,
  Chip,
  ConfirmDialog,
  Description,
  Label,
  Modal,
  Surface,
} from '@rozenite/ui';
import { Edit3 } from 'lucide-react';
import type {
  StorageEntry,
  StorageEntryType,
  StorageEntryValue,
} from '../shared/types';
import { TypedValueEditor } from './typed-value-editor';
import { defaultValueForType } from './type-conversion';

export type EditEntryDialogProps = {
  onClose: () => void;
  // Called with the runtime value in its native JS shape — the caller
  // infers the storage type from `typeof newValue`. Lets the dialog
  // change the entry's stored type (e.g. string → buffer) without a
  // dedicated prop for the new type.
  onEditEntry: (key: string, newValue: StorageEntryValue) => void;
  entry: StorageEntry | null;
  supportedTypes: StorageEntryType[];
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
  StorageEntryType,
  'success' | 'warning' | 'accent' | 'default'
> = {
  string: 'success',
  number: 'default',
  boolean: 'warning',
  buffer: 'accent',
};

export const EditEntryDialog = ({
  onClose,
  onEditEntry,
  entry,
  supportedTypes,
}: EditEntryDialogProps) => {
  const [currentType, setCurrentType] = useState<StorageEntryType>('string');
  const [currentValue, setCurrentValue] = useState<StorageEntryValue | null>(
    defaultValueForType('string'),
  );
  const [confirmDialog, setConfirmDialog] =
    useState<DialogState>(EMPTY_DIALOG_STATE);

  useEffect(() => {
    if (entry) {
      setCurrentType(entry.type);
      setCurrentValue(entry.value);
      setConfirmDialog(EMPTY_DIALOG_STATE);
    }
  }, [entry]);

  const isCurrentTypeSupported = supportedTypes.includes(currentType);

  const resetAndClose = () => {
    setCurrentType('string');
    setCurrentValue(defaultValueForType('string'));
    setConfirmDialog(EMPTY_DIALOG_STATE);
    onClose();
  };

  const handleSave = () => {
    if (!entry || currentValue === null) return;

    if (!isCurrentTypeSupported) {
      setConfirmDialog({
        isOpen: true,
        title: 'Unsupported Type',
        message: 'This storage does not support the selected type.',
        type: 'alert',
      });
      return;
    }

    onEditEntry(entry.key, currentValue);
    resetAndClose();
  };

  // Unsavable when the type isn't supported, or when the current value
  // is null (the hex editor signals invalid / empty hex as null —
  // empty bytes are not a meaningful entry to save).
  const isSaveDisabled = !isCurrentTypeSupported || currentValue === null;

  return (
    <>
      <Modal
        isOpen={entry !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            resetAndClose();
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
              <Modal.Body className="flex flex-col gap-4">
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
                    </div>

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
                        inputId="edit-entry-value"
                        autoFocus
                      />
                      {!isCurrentTypeSupported ? (
                        <Description className="text-xs text-warning">
                          This storage does not support {currentType} values.
                        </Description>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </Modal.Body>
              <Modal.Footer className="flex justify-end gap-2">
                <Button onPress={resetAndClose} variant="secondary">
                  Cancel
                </Button>
                <Button
                  isDisabled={isSaveDisabled}
                  onPress={handleSave}
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
