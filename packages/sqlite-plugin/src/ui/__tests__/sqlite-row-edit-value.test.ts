import { describe, expect, it } from 'vitest';
import { parseEditableFieldValue } from '../sqlite-row-edit-value';

describe('sqlite row edit value helpers', () => {
  it('converts blob-ish drafts into Uint8Array bind values', () => {
    expect(
      parseEditableFieldValue({
        kind: 'blob-ish',
        rawValue: '[1, 2, 255]',
      }),
    ).toEqual(new Uint8Array([1, 2, 255]));
  });

  it('serializes json drafts into JSON text bind values', () => {
    expect(
      parseEditableFieldValue({
        kind: 'json',
        rawValue: '{\n  "ok": true,\n  "count": 2\n}',
      }),
    ).toBe('{"ok":true,"count":2}');
  });
});
