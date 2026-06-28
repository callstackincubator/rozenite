import {
  Button,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Surface,
  TextArea,
  TextField,
} from '@rozenite/ui';
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

const stringifyDraftValue = (value: unknown, kind: EditableValueKind) => {
  if (value === null) {
    if (kind === 'boolean') {
      return 'false';
    }

    if (kind === 'blob-ish') {
      return '[]';
    }

    if (kind === 'json') {
      return '{}';
    }

    return '';
  }

  if (value === undefined) {
    if (kind === 'blob-ish') {
      return '[]';
    }

    if (kind === 'json') {
      return '{}';
    }

    return kind === 'boolean' ? 'false' : '';
  }

  if (kind === 'number' && typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (kind === 'boolean' && typeof value === 'number') {
    return value === 0 ? 'false' : 'true';
  }

  if (kind === 'blob-ish' || kind === 'json') {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
};

const createFieldDraft = (
  column: SqliteColumnInfo,
  value: unknown,
): EditableFieldDraft => {
  const compatibleKinds = getCompatibleValueKinds(column, value);
  const kind = compatibleKinds[0] ?? 'text';

  return {
    kind,
    rawValue: stringifyDraftValue(value, kind),
  };
};

const getKindLabel = (kind: EditableValueKind) => {
  if (kind === 'blob-ish') {
    return 'Blob';
  }

  if (kind === 'json') {
    return 'JSON';
  }

  if (kind === 'boolean') {
    return 'Boolean';
  }

  if (kind === 'number') {
    return 'Number';
  }

  if (kind === 'null') {
    return 'NULL';
  }

  return 'Text';
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
  const primaryKeyColumns = useMemo(
    () => getPrimaryKeyColumns(columns),
    [columns],
  );
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
        editableColumns.map((column) => [
          column.name,
          createFieldDraft(column, row[column.name]),
        ]),
      ),
    );
    setSubmitting(false);
    setError(null);
  }, [editableColumns, isOpen, row]);

  const handleKindChange = (columnName: string, kind: EditableValueKind) => {
    const column = editableColumns.find(
      (candidate) => candidate.name === columnName,
    );

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
                  : kind === 'number' &&
                      current[columnName]?.rawValue === 'true'
                    ? '1'
                    : kind === 'number' &&
                        current[columnName]?.rawValue === 'false'
                      ? '0'
                      : (current[columnName]?.rawValue ??
                        (column
                          ? createFieldDraft(column, null).rawValue
                          : '')),
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
      setError(
        nextError instanceof Error ? nextError.message : String(nextError),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <Modal.Backdrop variant="blur" isDismissable={!submitting}>
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog
            aria-label={`Edit row ${rowNumber} in ${entityName}`}
            className="w-full max-w-4xl"
          >
            <Modal.CloseTrigger isDisabled={submitting} />
            <Modal.Header>
              <Modal.Icon className="bg-info/15 text-info">
                <Pencil className="size-5" />
              </Modal.Icon>
              <div className="min-w-0">
                <Modal.Heading>Edit Row {rowNumber}</Modal.Heading>
                <p className="mt-1 text-xs text-muted">{entityName}</p>
              </div>
            </Modal.Header>

            <Modal.Body className="flex flex-col gap-5 p-6">
              {primaryKeyColumns.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">
                      Row Identifier
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Primary-key fields are shown for reference and cannot be
                      edited.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {primaryKeyColumns.map((column) => (
                      <Surface
                        key={column.name}
                        className="rounded-xl border border-border/70 p-3"
                        variant="secondary"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {column.name}
                            </p>
                            <p className="text-xs uppercase tracking-[0.24em] text-muted">
                              {column.type || 'value'}
                            </p>
                          </div>
                          <Chip size="sm" variant="soft">
                            PK
                          </Chip>
                        </div>
                        <p className="mt-3 break-all font-mono text-sm text-foreground">
                          {getValuePreview(row?.[column.name])}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {getValueKind(row?.[column.name])}
                        </p>
                      </Surface>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Editable Values
                  </h3>
                  <p className="mt-1 text-xs text-muted">
                    Update any non-primary-key column and save to write the row
                    back to SQLite.
                  </p>
                </div>

                {editableColumns.length === 0 ? (
                  <Surface
                    className="rounded-xl border border-border/70 p-4 text-sm text-muted"
                    variant="secondary"
                  >
                    This row does not expose editable, non-primary-key columns.
                  </Surface>
                ) : (
                  <div className="space-y-4">
                    {editableColumns.map((column) => {
                      const draft =
                        drafts[column.name] ??
                        createFieldDraft(column, row?.[column.name]);
                      const compatibleKinds = getCompatibleValueKinds(
                        column,
                        row?.[column.name],
                      );
                      const allowNull = canColumnBeNull(column);
                      const shouldUseTextArea =
                        draft.kind === 'blob-ish' ||
                        draft.kind === 'json' ||
                        (draft.kind === 'text' &&
                          draft.rawValue.includes('\n'));

                      return (
                        <Surface
                          key={column.name}
                          className="rounded-xl border border-border/70 p-4"
                          variant="secondary"
                        >
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <Label htmlFor={`sqlite-row-edit-${column.name}`}>
                                {column.name}
                              </Label>
                              <p className="mt-1 text-xs text-muted">
                                {column.type || 'value'}
                              </p>
                            </div>

                            {compatibleKinds.length > 1 || allowNull ? (
                              <div className="w-full max-w-[12rem]">
                                <Select
                                  aria-label={`Value type for ${column.name}`}
                                  className="w-full"
                                  isDisabled={submitting}
                                  onChange={(value) => {
                                    if (value == null) {
                                      return;
                                    }

                                    handleKindChange(
                                      column.name,
                                      String(value) as EditableValueKind,
                                    );
                                  }}
                                  value={draft.kind}
                                  variant="secondary"
                                >
                                  <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                  </Select.Trigger>
                                  <Select.Popover>
                                    <ListBox
                                      aria-label={`Value type for ${column.name}`}
                                    >
                                      {compatibleKinds.map((kind) => (
                                        <ListBox.Item
                                          key={kind}
                                          id={kind}
                                          textValue={getKindLabel(kind)}
                                        >
                                          {getKindLabel(kind)}
                                          <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                      ))}
                                      {allowNull ? (
                                        <ListBox.Item
                                          key="null"
                                          id="null"
                                          textValue="NULL"
                                        >
                                          NULL
                                          <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                      ) : null}
                                    </ListBox>
                                  </Select.Popover>
                                </Select>
                              </div>
                            ) : (
                              <Chip size="sm" variant="soft">
                                {getKindLabel(compatibleKinds[0] ?? 'text')}
                              </Chip>
                            )}
                          </div>

                          <div className="mt-3">
                            {draft.kind === 'null' ? (
                              <Surface
                                className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-sm text-muted"
                                variant="secondary"
                              >
                                This field will be saved as SQL NULL.
                              </Surface>
                            ) : draft.kind === 'boolean' ? (
                              <Select
                                aria-label={`Value for ${column.name}`}
                                className="w-full"
                                isDisabled={submitting}
                                onChange={(value) =>
                                  setDrafts((current) => ({
                                    ...current,
                                    [column.name]: {
                                      ...draft,
                                      rawValue:
                                        value == null ? '' : String(value),
                                    },
                                  }))
                                }
                                value={draft.rawValue}
                                variant="secondary"
                              >
                                <Select.Trigger>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox
                                    aria-label={`Boolean value for ${column.name}`}
                                  >
                                    <ListBox.Item
                                      id="true"
                                      key="true"
                                      textValue="true"
                                    >
                                      true
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    <ListBox.Item
                                      id="false"
                                      key="false"
                                      textValue="false"
                                    >
                                      false
                                      <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            ) : shouldUseTextArea ? (
                              <TextField className="w-full">
                                <TextArea
                                  id={`sqlite-row-edit-${column.name}`}
                                  className="min-h-28 w-full resize-y"
                                  disabled={submitting}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [column.name]: {
                                        ...draft,
                                        rawValue: event.target.value,
                                      },
                                    }))
                                  }
                                  value={draft.rawValue}
                                  variant="secondary"
                                />
                              </TextField>
                            ) : (
                              <TextField className="w-full" type="text">
                                <Input
                                  id={`sqlite-row-edit-${column.name}`}
                                  disabled={submitting}
                                  onChange={(event) =>
                                    setDrafts((current) => ({
                                      ...current,
                                      [column.name]: {
                                        ...draft,
                                        rawValue: event.target.value,
                                      },
                                    }))
                                  }
                                  value={draft.rawValue}
                                  variant="secondary"
                                />
                              </TextField>
                            )}
                          </div>

                          <Description className="mt-2 text-xs text-muted">
                            Current value: {getValuePreview(row?.[column.name])}{' '}
                            ({getValueKind(row?.[column.name])}) · Compatible:{' '}
                            {compatibleKinds
                              .map((kind) =>
                                kind === 'blob-ish'
                                  ? 'blob'
                                  : kind === 'json'
                                    ? 'json'
                                    : kind,
                              )
                              .join(', ')}
                            {allowNull ? ', null' : ''}
                          </Description>
                        </Surface>
                      );
                    })}
                  </div>
                )}
              </section>

              {error ? (
                <Surface
                  aria-live="polite"
                  className="rounded-xl border border-danger/35 bg-danger/10 px-4 py-3 text-danger"
                  variant="secondary"
                >
                  <p className="font-medium">Save Failed</p>
                  <p className="mt-1 text-sm text-danger">{error}</p>
                </Surface>
              ) : null}
            </Modal.Body>
            <Modal.Footer className="flex justify-end gap-2">
              <Button
                isDisabled={submitting}
                onPress={onClose}
                variant="secondary"
              >
                Cancel
              </Button>
              <Button
                isDisabled={submitting || editableColumns.length === 0}
                onPress={() => void handleSave()}
                variant="primary"
              >
                <Save aria-hidden="true" className="size-4" />
                {submitting ? 'Saving…' : 'Save Changes'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
