import { Modal, useOverlayState } from '@heroui/react';
import { Pencil, Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { SqliteColumnInfo } from './sqlite-introspection';
import {
  SqliteModalCloseButton,
  sqlitePrimaryButtonClassName,
  sqliteSecondaryButtonClassName,
} from './sqlite-modal-controls';
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

export const SqliteRowEditModal = ({
  isOpen,
  rowNumber,
  entityName,
  row,
  columns,
  onClose,
  onSave,
}: SqliteRowEditModalProps) => {
  const overlay = useOverlayState({
    isOpen,
    onOpenChange: (open: boolean) => {
      if (!open) {
        onClose();
      }
    },
  });
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
                  : current[columnName]?.rawValue ??
                    (column ? createFieldDraft(column, null).rawValue : ''),
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

  return (
    <Modal state={overlay}>
      <Modal.Backdrop
        variant="blur"
        isDismissable={!submitting}
        className="bg-[rgba(5,10,16,0.24)] backdrop-blur-[2px]"
      >
        <Modal.Container placement="center" size="lg" scroll="inside">
          <Modal.Dialog
            aria-label={`Edit row ${rowNumber} in ${entityName}`}
            className="w-full max-w-4xl overflow-hidden border border-white/10 bg-[#0a121b] p-0 text-white shadow-[0_30px_90px_rgba(0,0,0,0.42)]"
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <Pencil aria-hidden="true" className="h-4 w-4 text-sky-300" />
                  <h2 className="text-lg font-semibold text-white">
                    Edit Row {rowNumber}
                  </h2>
                </div>
                <p className="mt-1 text-sm text-slate-400">{entityName}</p>
              </div>
              <SqliteModalCloseButton onClose={onClose} disabled={submitting} />
            </div>

            <Modal.Body className="space-y-0 p-0">
              <div className="space-y-5 px-5 py-5">
                {primaryKeyColumns.length > 0 ? (
                  <section className="space-y-3">
                    <div>
                      <h3 className="text-sm font-medium text-slate-200">
                        Row Identifier
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Primary-key fields are shown for reference and cannot be edited.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {primaryKeyColumns.map((column) => (
                        <div
                          key={column.name}
                          className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {column.name}
                              </p>
                              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                                {column.type || 'value'}
                              </p>
                            </div>
                            <span className="sqlite-chip sqlite-chip-static">PK</span>
                          </div>
                          <p className="mt-3 break-all font-mono text-sm text-slate-200">
                            {getValuePreview(row?.[column.name])}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getValueKind(row?.[column.name])}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-medium text-slate-200">
                      Editable Values
                    </h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Update any non-primary-key column and save to write the row back
                      to SQLite.
                    </p>
                  </div>

                  {editableColumns.length === 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-slate-300">
                      This row does not expose editable, non-primary-key columns.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {editableColumns.map((column) => {
                        const draft =
                          drafts[column.name] ?? createFieldDraft(column, row?.[column.name]);
                        const compatibleKinds = getCompatibleValueKinds(
                          column,
                          row?.[column.name],
                        );
                        const allowNull = canColumnBeNull(column);
                        const shouldUseTextArea =
                          draft.kind === 'blob-ish' ||
                          draft.kind === 'json' ||
                          (draft.kind === 'text' && draft.rawValue.includes('\n'));

                        return (
                          <div
                            key={column.name}
                            className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                          >
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="min-w-0">
                                <label
                                  htmlFor={`sqlite-row-edit-${column.name}`}
                                  className="text-sm font-medium text-white"
                                >
                                  {column.name}
                                </label>
                                <p className="mt-1 text-xs text-slate-500">
                                  {column.type || 'value'}
                                </p>
                              </div>

                              {compatibleKinds.length > 1 || allowNull ? (
                                <div className="w-full max-w-[12rem]">
                                  <label
                                    htmlFor={`sqlite-row-edit-type-${column.name}`}
                                    className="sr-only"
                                  >
                                    Value type
                                  </label>
                                  <select
                                    id={`sqlite-row-edit-type-${column.name}`}
                                    className="sqlite-select w-full"
                                    value={draft.kind}
                                    disabled={submitting}
                                    onChange={(event) =>
                                      handleKindChange(
                                        column.name,
                                        event.target.value as EditableValueKind,
                                      )
                                    }
                                  >
                                    {compatibleKinds.map((kind) => (
                                      <option key={kind} value={kind}>
                                        {kind === 'blob-ish'
                                          ? 'Blob'
                                          : kind === 'json'
                                            ? 'JSON'
                                            : kind === 'boolean'
                                              ? 'Boolean'
                                              : kind === 'number'
                                                ? 'Number'
                                                : 'Text'}
                                      </option>
                                    ))}
                                    {allowNull ? <option value="null">NULL</option> : null}
                                  </select>
                                </div>
                              ) : (
                                <span className="sqlite-chip sqlite-chip-static">
                                  {compatibleKinds[0] === 'blob-ish'
                                    ? 'Blob'
                                    : compatibleKinds[0] === 'json'
                                      ? 'JSON'
                                      : compatibleKinds[0] === 'boolean'
                                        ? 'Boolean'
                                        : compatibleKinds[0] === 'number'
                                          ? 'Number'
                                          : 'Text'}
                                </span>
                              )}
                            </div>

                            <div className="mt-3">
                              {draft.kind === 'null' ? (
                                <div className="rounded-xl border border-dashed border-white/10 bg-black/10 px-3 py-2 text-sm text-slate-400">
                                  This field will be saved as SQL NULL.
                                </div>
                              ) : draft.kind === 'boolean' ? (
                                <select
                                  id={`sqlite-row-edit-${column.name}`}
                                  className="sqlite-select w-full"
                                  value={draft.rawValue}
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
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : shouldUseTextArea ? (
                                <textarea
                                  id={`sqlite-row-edit-${column.name}`}
                                  className="sqlite-input min-h-28 w-full resize-y py-3"
                                  value={draft.rawValue}
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
                                />
                              ) : (
                                <input
                                  id={`sqlite-row-edit-${column.name}`}
                                  type="text"
                                  className="sqlite-input w-full"
                                  value={draft.rawValue}
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
                                />
                              )}
                            </div>

                            <p className="mt-2 text-xs text-slate-500">
                              Current value: {getValuePreview(row?.[column.name])} (
                              {getValueKind(row?.[column.name])}) · Compatible:{' '}
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
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {error ? (
                  <div className="sqlite-inline-error" aria-live="polite">
                    <div>
                      <p className="font-medium text-rose-100">Save Failed</p>
                      <p className="mt-1 text-sm text-rose-100/90">{error}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-white/8 px-5 py-5">
                <button
                  type="button"
                  className={sqliteSecondaryButtonClassName}
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={sqlitePrimaryButtonClassName}
                  onClick={() => void handleSave()}
                  disabled={submitting || editableColumns.length === 0}
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {submitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
