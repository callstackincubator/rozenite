import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Chip,
  Description,
  Label,
  Modal,
  Surface,
} from '@heroui/react';
import { Edit3, Info } from 'lucide-react';
import { JsonInspector } from './json-inspector';
import { parseJsonForInspection } from '../utils/json';
import type { JsonInspectionParseResult } from '../utils/json';

export type EntryDetailChipColor =
  | 'success'
  | 'danger'
  | 'warning'
  | 'accent'
  | 'default';

export type EntryDetailEntry = {
  key: string;
  type: string;
  value: unknown;
};

export type EntryDetailDialogProps<T extends EntryDetailEntry> = {
  entry: T | null;
  onClose: () => void;
  onEdit?: (entry: T) => void;
  /** Maps an entry type to a Chip color. */
  typeColor?: (type: T['type']) => EntryDetailChipColor;
  /**
   * Returns inspectable JSON for an entry. When `ok`, the value is rendered
   * with `JsonInspector`; otherwise `renderValue` is used. Defaults to parsing
   * string values as a JSON object/array.
   */
  getInspectableJson?: (entry: T) => JsonInspectionParseResult;
  /** Renders the value when it is not inspectable JSON. */
  renderValue: (entry: T) => ReactNode;
};

const DEFAULT_TYPE_COLOR: Record<string, EntryDetailChipColor> = {
  string: 'success',
  number: 'default',
  boolean: 'warning',
  buffer: 'accent',
};

const defaultTypeColor = (type: string): EntryDetailChipColor =>
  DEFAULT_TYPE_COLOR[type] ?? 'default';

const defaultGetInspectableJson = (
  entry: EntryDetailEntry,
): JsonInspectionParseResult =>
  entry.type === 'string' && typeof entry.value === 'string'
    ? parseJsonForInspection(entry.value, 'object-or-array')
    : { ok: false, value: null };

export const EntryDetailDialog = <T extends EntryDetailEntry>({
  entry,
  onClose,
  onEdit,
  typeColor = defaultTypeColor,
  getInspectableJson = defaultGetInspectableJson,
  renderValue,
}: EntryDetailDialogProps<T>) => {
  const jsonResult = useMemo<JsonInspectionParseResult>(
    () => (entry ? getInspectableJson(entry) : { ok: false, value: null }),
    [entry, getInspectableJson],
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
            aria-label="Entry Details"
            className="flex max-h-[90vh] flex-col"
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
                      color={typeColor(entry.type)}
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
                      {jsonResult.ok ? (
                        <JsonInspector
                          copyable
                          data={jsonResult.value}
                          shouldExpandNodeInitially={(keyPath) =>
                            keyPath.length <= 2
                          }
                        />
                      ) : (
                        <div className="min-h-4 text-sm">
                          {renderValue(entry)}
                        </div>
                      )}
                    </Surface>
                    {entry.type === 'string' && jsonResult.ok ? (
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
