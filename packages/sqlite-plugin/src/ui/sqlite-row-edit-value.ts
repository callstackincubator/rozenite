export type EditableValueKind =
  | 'null'
  | 'text'
  | 'number'
  | 'boolean'
  | 'blob-ish'
  | 'json';

export type EditableFieldDraft = {
  kind: EditableValueKind;
  rawValue: string;
};

export const parseEditableFieldValue = (draft: EditableFieldDraft): unknown => {
  switch (draft.kind) {
    case 'null':
      return null;
    case 'text':
      return draft.rawValue;
    case 'number': {
      const value = Number(draft.rawValue.trim());

      if (Number.isNaN(value)) {
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

      if (
        !Array.isArray(parsed) ||
        !parsed.every((item) => typeof item === 'number')
      ) {
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
