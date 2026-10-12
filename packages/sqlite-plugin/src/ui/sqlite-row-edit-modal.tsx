import { Alert, Badge, Button, Dialog, Input, Select, Text, Textarea } from '@rozenite/ui';
import { Pencil, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SqliteColumnInfo } from './sqlite-introspection';
import {
  canColumnBeNull,
  getCompatibleValueKinds,
  getEditableColumns,
  getPrimaryKeyColumns,
} from './sqlite-row-mutations';
import {
  createFieldDraft,
  parseEditableFieldValue,
  type EditableFieldDraft,
  type EditableValueKind,
} from './sqlite-row-edit-value';
import { getValueKind, getValuePreview } from './value-utils';

type SqliteRowEditModalProps = {
  isOpen: boolean;
  rowNumber: number;
  entityName: string;
  row: Record<string, unknown> | null;
  columns: SqliteColumnInfo[];
  onClose: () => void;
  onSave: (nextValues: Record<string, unknown>) => Promise<void>;
};

const KIND_LABELS: Record<EditableValueKind, string> = {
  text: 'Text',
  number: 'Number',
  boolean: 'Boolean',
  'blob-ish': 'Blob',
  json: 'JSON',
  null: 'NULL',
};

export const SqliteRowEditModal = ({
  isOpen,
  rowNumber,
  entityName,
  row,
  columns,
  onClose,
  onSave,
}: SqliteRowEditModalProps) => {
  const primaryKeyColumns = useMemo(() => getPrimaryKeyColumns(columns), [columns]);
  const editableColumns = useMemo(() => getEditableColumns(columns), [columns]);
  const [drafts, setDrafts] = useState<Record<string, EditableFieldDraft>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !row) {
      setDrafts({});
      setSubmitting(false);
      setError(null);
      return;
    }

    setDrafts(
      Object.fromEntries(
        editableColumns.map((column) => [column.name, createFieldDraft(column, row[column.name])]),
      ),
    );
    setSubmitting(false);
    setError(null);
  }, [editableColumns, isOpen, row]);

  const handleKindChange = (columnName: string, kind: EditableValueKind) => {
    const column = editableColumns.find((candidate) => candidate.name === columnName);

    setDrafts((current) => ({
      ...current,
      [columnName]: {
        kind,
        rawValue:
          kind === 'boolean'
            ? 'false'
            : kind === 'blob-ish'
              ? '[]'
              : kind === 'json'
                ? '{}'
                : kind === 'null'
                  ? ''
                  : kind === 'number' && current[columnName]?.rawValue === 'true'
                    ? '1'
                    : kind === 'number' && current[columnName]?.rawValue === 'false'
                      ? '0'
                      : (current[columnName]?.rawValue ??
                        (column ? createFieldDraft(column, null).rawValue : '')),
      },
    }));
  };

  const handleSave = async () => {
    if (!row) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const nextValues = Object.fromEntries(
        editableColumns.map((column) => [
          column.name,
          parseEditableFieldValue(
            drafts[column.name] ?? createFieldDraft(column, row[column.name]),
          ),
        ]),
      );

      await onSave(nextValues);
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setSubmitting(false);
    }
  };

  const updateDraft = (columnName: string, draft: EditableFieldDraft, rawValue: string) =>
    setDrafts((current) => ({
      ...current,
      [columnName]: { ...draft, rawValue },
    }));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !submitting) {
          onClose();
        }
      }}
    >
      <Dialog.Content
        className="max-w-3xl"
        aria-label={`Edit row ${rowNumber} in ${entityName}`}
        showCloseButton={!submitting}
      >
        <Dialog.Header>
          <div className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Dialog.Title>Edit Row {rowNumber}</Dialog.Title>
          </div>
          <Dialog.Description className="font-mono text-xs">{entityName}</Dialog.Description>
        </Dialog.Header>

        <div className="flex max-h-[60vh] flex-col gap-5 overflow-auto pr-1">
          {primaryKeyColumns.length > 0 ? (
            <section className="flex flex-col gap-2">
              <div>
                <Text variant="heading">Row Identifier</Text>
                <p className="text-xs text-muted-foreground">
                  Primary-key fields are shown for reference and cannot be edited.
                </p>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {primaryKeyColumns.map((column) => (
                  <div key={column.name} className="border border-border bg-muted p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{column.name}</p>
                        <Text variant="label" className="text-[10px]">
                          {column.type || 'value'}
                        </Text>
                      </div>
                      <Badge tone="neutral" variant="outline">
                        PK
                      </Badge>
                    </div>
                    <p className="mt-2 font-mono text-xs break-all">
                      {getValuePreview(row?.[column.name])}
                    </p>
                    <Text variant="label" className="text-[10px]">
                      {getValueKind(row?.[column.name])}
                    </Text>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="flex flex-col gap-2">
            <div>
              <Text variant="heading">Editable Values</Text>
              <p className="text-xs text-muted-foreground">
                Update any non-primary-key column and save to write the row back to SQLite.
              </p>
            </div>

            {editableColumns.length === 0 ? (
              <div className="border border-border bg-muted p-3 text-sm text-muted-foreground">
                This row does not expose editable, non-primary-key columns.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {editableColumns.map((column) => {
                  const draft = drafts[column.name] ?? createFieldDraft(column, row?.[column.name]);
                  const compatibleKinds = getCompatibleValueKinds(column, row?.[column.name]);
                  const allowNull = canColumnBeNull(column);
                  const shouldUseTextArea =
                    draft.kind === 'blob-ish' ||
                    draft.kind === 'json' ||
                    (draft.kind === 'text' && draft.rawValue.includes('\n'));
                  const fieldId = `sqlite-row-edit-${column.name}`;
                  const typeOptions: EditableValueKind[] = allowNull
                    ? [...compatibleKinds, 'null']
                    : compatibleKinds;

                  return (
                    <div key={column.name} className="border border-border bg-muted/40 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Text
                            variant="heading"
                            render={<label htmlFor={fieldId} />}
                            className="block truncate"
                          >
                            {column.name}
                          </Text>
                          <Text variant="label" className="text-[10px]">
                            {column.type || 'value'}
                          </Text>
                        </div>

                        {compatibleKinds.length > 1 || allowNull ? (
                          <Select
                            value={draft.kind}
                            disabled={submitting}
                            onValueChange={(value) =>
                              handleKindChange(column.name, value as EditableValueKind)
                            }
                          >
                            <Select.Trigger
                              size="sm"
                              className="w-36"
                              aria-label={`Value type for ${column.name}`}
                            >
                              <Select.Value>
                                {(value: EditableValueKind) => KIND_LABELS[value] ?? value}
                              </Select.Value>
                            </Select.Trigger>
                            <Select.Content>
                              {typeOptions.map((kind) => (
                                <Select.Item key={kind} value={kind}>
                                  {KIND_LABELS[kind]}
                                </Select.Item>
                              ))}
                            </Select.Content>
                          </Select>
                        ) : (
                          <Badge tone="neutral" variant="outline">
                            {KIND_LABELS[compatibleKinds[0] ?? 'text']}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-2">
                        {draft.kind === 'null' ? (
                          <div className="border border-dashed border-border-strong px-3 py-2 text-sm text-muted-foreground">
                            This field will be saved as SQL NULL.
                          </div>
                        ) : draft.kind === 'boolean' ? (
                          <Select
                            value={draft.rawValue}
                            disabled={submitting}
                            onValueChange={(value) =>
                              updateDraft(column.name, draft, String(value))
                            }
                          >
                            <Select.Trigger
                              id={fieldId}
                              className="w-full"
                              aria-label={`Value for ${column.name}`}
                            >
                              <Select.Value>{(value: string) => value}</Select.Value>
                            </Select.Trigger>
                            <Select.Content>
                              <Select.Item value="true">true</Select.Item>
                              <Select.Item value="false">false</Select.Item>
                            </Select.Content>
                          </Select>
                        ) : shouldUseTextArea ? (
                          <Textarea
                            id={fieldId}
                            className="min-h-28 font-mono text-xs"
                            value={draft.rawValue}
                            disabled={submitting}
                            onChange={(event) =>
                              updateDraft(column.name, draft, event.target.value)
                            }
                          />
                        ) : (
                          <Input
                            id={fieldId}
                            className="font-mono text-xs"
                            value={draft.rawValue}
                            disabled={submitting}
                            onChange={(event) =>
                              updateDraft(column.name, draft, event.target.value)
                            }
                          />
                        )}
                      </div>

                      <p className="mt-2 text-xs text-faint">
                        Current value: {getValuePreview(row?.[column.name])} (
                        {getValueKind(row?.[column.name])}) · Compatible:{' '}
                        {compatibleKinds
                          .map((kind) =>
                            kind === 'blob-ish' ? 'blob' : kind === 'json' ? 'json' : kind,
                          )
                          .join(', ')}
                        {allowNull ? ', null' : ''}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {error ? (
            <Alert tone="danger" aria-live="polite">
              <Alert.Title>Save Failed</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
            </Alert>
          ) : null}
        </div>

        <Dialog.Footer>
          <Button tone="neutral" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={submitting || editableColumns.length === 0}
          >
            <Save aria-hidden="true" />
            {submitting ? 'Saving…' : 'Save Changes'}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
};
