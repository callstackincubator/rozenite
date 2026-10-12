import type { SqliteColumnInfo } from './sqlite-introspection';
import { canColumnBeNull, getCompatibleValueKinds } from './sqlite-row-mutations';

export type EditableValueKind = 'null' | 'text' | 'number' | 'boolean' | 'blob-ish' | 'json';

export type EditableFieldDraft = {
  kind: EditableValueKind;
  rawValue: string;
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

/**
 * The draft an edit form starts from. A NULL stays NULL (when the column allows it): defaulting
 * it to the column's value kind would write 0, '' or an empty blob over it on save.
 */
export const createFieldDraft = (column: SqliteColumnInfo, value: unknown): EditableFieldDraft => {
  if (value === null && canColumnBeNull(column)) {
    return { kind: 'null', rawValue: '' };
  }

  const compatibleKinds = getCompatibleValueKinds(column, value);
  const kind = compatibleKinds[0] ?? 'text';

  return {
    kind,
    rawValue: stringifyDraftValue(value, kind),
  };
};

export const parseEditableFieldValue = (draft: EditableFieldDraft): unknown => {
  switch (draft.kind) {
    case 'null':
      return null;
    case 'text':
      return draft.rawValue;
    case 'number': {
      const text = draft.rawValue.trim();
      const value = Number(text);

      if (text === '' || Number.isNaN(value)) {
        throw new Error('Enter a valid number.');
      }

      return value;
    }
    case 'boolean': {
      if (draft.rawValue !== 'true' && draft.rawValue !== 'false') {
        throw new Error('Choose either true or false.');
      }

      return draft.rawValue === 'true';
    }
    case 'blob-ish': {
      const parsed = JSON.parse(draft.rawValue);

      if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'number')) {
        throw new Error('Blob values must be JSON arrays of numbers.');
      }

      return new Uint8Array(parsed);
    }
    case 'json': {
      const parsed = JSON.parse(draft.rawValue);
      return JSON.stringify(parsed);
    }
  }
};
