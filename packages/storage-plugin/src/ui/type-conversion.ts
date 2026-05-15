import type { StorageEntryType, StorageEntryValue } from '../shared/types';

const textEncoder = new TextEncoder();
const strictDecoder = new TextDecoder('utf-8', { fatal: true });

// Decode bytes to a string. Returns the empty string when the bytes
// are not valid UTF-8 — used when the user switches a Hex editor's
// non-UTF-8 buffer back to a text editor, where there's no faithful
// representation to preserve.
const tryDecode = (bytes: readonly number[]): string => {
  try {
    return strictDecoder.decode(new Uint8Array(bytes));
  } catch {
    return '';
  }
};

const encode = (value: string): number[] =>
  Array.from(textEncoder.encode(value));

// Convert a value between storage primitive types for the editor
// switcher. The headline transition is `string` ↔ `buffer`, which
// round-trips via UTF-8 — the user opens a string entry, picks Hex,
// and sees the bytes of that string. Other transitions preserve as
// much information as the destination type can carry, falling back to
// the destination's zero value when nothing meaningful remains.
export const convertValue = (
  from: StorageEntryType,
  to: StorageEntryType,
  value: StorageEntryValue,
): StorageEntryValue => {
  if (from === to) return value;

  if (from === 'string') {
    const str = value as string;
    switch (to) {
      case 'number': {
        const n = Number(str);
        return Number.isNaN(n) ? 0 : n;
      }
      case 'boolean':
        return str === 'true';
      case 'buffer':
        return encode(str);
    }
  }

  if (from === 'number') {
    const n = value as number;
    switch (to) {
      case 'string':
        return String(n);
      case 'boolean':
        return n !== 0;
      case 'buffer':
        return encode(String(n));
    }
  }

  if (from === 'boolean') {
    const b = value as boolean;
    switch (to) {
      case 'string':
        return String(b);
      case 'number':
        return b ? 1 : 0;
      case 'buffer':
        return encode(String(b));
    }
  }

  if (from === 'buffer') {
    const bytes = value as number[];
    switch (to) {
      case 'string':
        return tryDecode(bytes);
      case 'number': {
        const decoded = tryDecode(bytes);
        const n = Number(decoded);
        return Number.isNaN(n) ? 0 : n;
      }
      case 'boolean':
        return tryDecode(bytes) === 'true';
    }
  }

  return value;
};

// Zero value for a type — used when seeding the add-entry dialog and
// when conversion has no meaningful starting point.
export const defaultValueForType = (
  type: StorageEntryType,
): StorageEntryValue => {
  switch (type) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'buffer':
      return [];
  }
};
