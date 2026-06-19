import { describe, expect, it } from 'vitest';
import {
  initialState,
  reduce,
  validate,
  type EditorState,
} from '../binary-value-editor-state';

const hexState = (bytes?: number[]): EditorState =>
  initialState({ initialBytes: bytes, mode: 'hex' });

describe('initialState', () => {
  it('defaults to hex mode and empty text when no initialBytes', () => {
    expect(initialState({})).toEqual({
      mode: 'hex',
      text: '',
      bytes: null,
      error: null,
    });
  });

  it('encodes initial bytes as grouped hex when mode is hex', () => {
    expect(initialState({ initialBytes: [0x89, 0x50, 0x4e, 0x47] })).toEqual({
      mode: 'hex',
      text: '89 50 4E 47',
      bytes: [0x89, 0x50, 0x4e, 0x47],
      error: null,
    });
  });

  it('encodes initial bytes as base64 when mode is base64', () => {
    expect(
      initialState({ initialBytes: [0x48, 0x69], mode: 'base64' }),
    ).toEqual({
      mode: 'base64',
      text: 'SGk=',
      bytes: [0x48, 0x69],
      error: null,
    });
  });

  it('treats empty initial bytes the same as no bytes', () => {
    expect(initialState({ initialBytes: [] })).toEqual({
      mode: 'hex',
      text: '',
      bytes: null,
      error: null,
    });
  });
});

describe('reduce: set-text', () => {
  it('parses valid hex into bytes', () => {
    const next = reduce(hexState(), { type: 'set-text', text: '89 50 4E 47' });
    expect(next).toEqual({
      mode: 'hex',
      text: '89 50 4E 47',
      bytes: [0x89, 0x50, 0x4e, 0x47],
      error: null,
    });
  });

  it('keeps invalid hex text but clears bytes and surfaces the parse error', () => {
    const next = reduce(hexState(), { type: 'set-text', text: 'gg' });
    expect(next).toEqual({
      mode: 'hex',
      text: 'gg',
      bytes: null,
      error: 'Hex input contains invalid characters.',
    });
  });

  it('keeps trailing-nibble text but reports incomplete bytes', () => {
    const next = reduce(hexState(), { type: 'set-text', text: '89 5' });
    expect(next).toEqual({
      mode: 'hex',
      text: '89 5',
      bytes: null,
      error: 'Hex input must contain complete bytes.',
    });
  });

  it('surfaces the empty-input error for cleared text', () => {
    const next = reduce(hexState([0x89]), { type: 'set-text', text: '' });
    expect(next).toEqual({
      mode: 'hex',
      text: '',
      bytes: null,
      error: 'Enter at least one byte.',
    });
  });

  it('does not rewrite text (paste filter is responsible for that)', () => {
    // Even though "DEAD" would canonicalise to "DE AD", set-text must
    // preserve the user's exact text. Only normalize-paste rewrites it.
    const next = reduce(hexState(), { type: 'set-text', text: 'DEAD' });
    expect(next.text).toBe('DEAD');
    expect(next.bytes).toEqual([0xde, 0xad]);
  });
});

describe('reduce: normalize-paste', () => {
  it('rewrites pasted hexdump into canonical grouped hex', () => {
    const pasted =
      '00000000  89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52  |.PNG........IHDR|';
    const next = reduce(hexState(), { type: 'normalize-paste', text: pasted });
    expect(next.text).toBe('89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52');
    expect(next.bytes).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
    ]);
    expect(next.error).toBeNull();
  });

  it('rewrites pasted base64 into canonical base64', () => {
    const state = initialState({ mode: 'base64' });
    const next = reduce(state, {
      type: 'normalize-paste',
      text: '  SGVs\nbG8=  ',
    });
    expect(next.text).toBe('SGVsbG8=');
    expect(next.bytes).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
  });

  it('keeps the raw pasted text and reports the error when invalid', () => {
    const next = reduce(hexState(), {
      type: 'normalize-paste',
      text: 'oh no',
    });
    expect(next.text).toBe('oh no');
    expect(next.bytes).toBeNull();
    expect(next.error).toBe('Hex input contains invalid characters.');
  });
});

describe('reduce: switch-mode', () => {
  it('converts valid bytes in place when switching hex -> base64', () => {
    const start = reduce(hexState(), { type: 'set-text', text: '48 69' });
    const next = reduce(start, { type: 'switch-mode', mode: 'base64' });
    expect(next).toEqual({
      mode: 'base64',
      text: 'SGk=',
      bytes: [0x48, 0x69],
      error: null,
    });
  });

  it('converts valid bytes in place when switching base64 -> hex', () => {
    const start = reduce(initialState({ mode: 'base64' }), {
      type: 'set-text',
      text: 'SGk=',
    });
    const next = reduce(start, { type: 'switch-mode', mode: 'hex' });
    expect(next).toEqual({
      mode: 'hex',
      text: '48 69',
      bytes: [0x48, 0x69],
      error: null,
    });
  });

  it('clears text and error when current input is invalid', () => {
    const invalid = reduce(hexState(), { type: 'set-text', text: '89 5' });
    const next = reduce(invalid, { type: 'switch-mode', mode: 'base64' });
    expect(next).toEqual({
      mode: 'base64',
      text: '',
      bytes: null,
      error: null,
    });
  });

  it('is a no-op when the mode is unchanged', () => {
    const state = reduce(hexState(), { type: 'set-text', text: '89 50' });
    expect(reduce(state, { type: 'switch-mode', mode: 'hex' })).toBe(state);
  });
});

describe('validate', () => {
  it('passes when bytes are valid and non-empty', () => {
    const state = reduce(hexState(), { type: 'set-text', text: '89 50' });
    expect(validate(state)).toEqual({ ok: true, bytes: [0x89, 0x50] });
  });

  it('fails with the parse error when input is invalid', () => {
    const state = reduce(hexState(), { type: 'set-text', text: 'gg' });
    expect(validate(state)).toEqual({
      ok: false,
      reason: 'Hex input contains invalid characters.',
    });
  });

  it('fails with the empty-input message when nothing is entered', () => {
    expect(validate(hexState())).toEqual({
      ok: false,
      reason: 'Enter at least one byte.',
    });
  });
});
