import { useMemo } from 'react';
import {
  Button,
  Chip,
  Description,
  JsonInspector,
  Label,
  Modal,
  parseJsonForInspection,
  Surface,
} from '@rozenite/ui';
import { Edit3, Info } from 'lucide-react';
import type { StorageEntry, StorageEntryType } from '../shared/types';
import { bytesToHexdump } from './binary';

export type EntryDetailDialogProps = {
  onClose: () => void;
  onEdit?: (entry: StorageEntry) => void;
  entry: StorageEntry | null;
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

const formatValue = (entry: StorageEntry) => {
  if (entry.type === 'string') {
    return (
      <span className="break-all font-mono text-sm text-success">
        "{entry.value}"
      </span>
    );
  }

  if (entry.type === 'number') {
    return (
      <span className="font-mono text-sm text-foreground">{entry.value}</span>
    );
  }

  if (entry.type === 'boolean') {
    return (
      <span
        className={`font-mono text-sm ${
          entry.value ? 'text-success' : 'text-danger'
        }`}
      >
        {entry.value ? 'true' : 'false'}
      </span>
    );
  }

  // buffer — show a full hexdump
  const bufferArray = entry.value as number[];
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">
        {bufferArray.length} {bufferArray.length === 1 ? 'byte' : 'bytes'}
      </div>
      <pre className="font-mono text-xs text-accent whitespace-pre overflow-auto leading-snug">
        {bytesToHexdump(bufferArray)}
      </pre>
    </div>
  );
};

export const EntryDetailDialog = ({
  onClose,
  onEdit,
  entry,
}: EntryDetailDialogProps) => {
  const isStringValue = entry?.type === 'string';
  const stringValue = isStringValue ? entry.value : '';
  const jsonParseResult = useMemo(
    () =>
      isStringValue
        ? parseJsonForInspection(stringValue, 'object-or-array')
        : { ok: false as const, value: null },
    [isStringValue, stringValue],
  );

  return (
    <Modal
      isOpen={entry !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Modal.Backdrop variant="blur">
        <Modal.Container className="w-full max-w-2xl" placement="center">
          <Modal.Dialog
            className="flex max-h-[90vh] flex-col"
            aria-label="Entry Details"
          >
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-info/15 text-info">
                <Info className="size-5" />
              </Modal.Icon>
              <Modal.Heading>Entry Details</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
              {entry ? (
                <>
                  <div className="flex flex-col gap-2">
                    <Label>Key</Label>
                    <Surface
                      className="rounded-lg border border-border/70 bg-surface-secondary px-3 py-2 font-mono text-sm text-foreground break-all"
                      variant="secondary"
                    >
                      {entry.key}
                    </Surface>
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

                  <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <Label>Value</Label>
                    <Surface
                      className="max-h-96 overflow-auto rounded-lg border border-border/70 bg-surface-secondary p-3"
                      variant="secondary"
                    >
                      {jsonParseResult.ok ? (
                        <JsonInspector
                          copyable
                          data={jsonParseResult.value}
                          shouldExpandNodeInitially={(keyPath) =>
                            keyPath.length <= 2
                          }
                          theme="dark"
                        />
                      ) : (
                        <div className="min-h-4 text-sm">
                          {formatValue(entry)}
                        </div>
                      )}
                    </Surface>
                    {entry.type === 'string' && jsonParseResult.ok ? (
                      <Description className="text-xs text-muted">
                        Displaying parsed JSON from the stored string value.
                      </Description>
                    ) : null}
                  </div>
                </>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              {entry && onEdit ? (
                <Button onPress={() => onEdit(entry)} variant="secondary">
                  <Edit3 className="size-4" />
                  Edit
                </Button>
              ) : null}
              <Button onPress={onClose} variant="primary">
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
