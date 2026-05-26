import { describe, expect, it } from 'vitest';
import {
  BYTES_PER_HEX_ROW,
  formatHexRow,
  rowCountForByteLength,
  toAsciiChar,
  toHexPair,
} from '../hex';

describe('toHexPair', () => {
  it('uppercases and zero-pads to two characters', () => {
    expect(toHexPair(0)).toBe('00');
    expect(toHexPair(0x0a)).toBe('0A');
    expect(toHexPair(0xff)).toBe('FF');
  });
});

describe('toAsciiChar', () => {
  it('renders printable ASCII characters verbatim', () => {
    expect(toAsciiChar(0x20)).toBe(' ');
    expect(toAsciiChar(0x41)).toBe('A');
    expect(toAsciiChar(0x7e)).toBe('~');
  });

  it('renders non-printable bytes as a dot', () => {
    expect(toAsciiChar(0x00)).toBe('.');
    expect(toAsciiChar(0x1f)).toBe('.');
    expect(toAsciiChar(0x7f)).toBe('.');
    expect(toAsciiChar(0xff)).toBe('.');
  });
});

describe('formatHexRow', () => {
  it('formats a full row with the post-byte-8 double-space gap', () => {
    const bytes = new Uint8Array([
      0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x20, 0x77, 0x6f, 0x72, 0x6c, 0x64, 0x21,
      0x0a, 0x0d, 0x09, 0xff,
    ]);
    const row = formatHexRow(bytes, 0);
    expect(row.offset).toBe('00000000');
    expect(row.hex).toBe('48 65 6C 6C 6F 20 77 6F  72 6C 64 21 0A 0D 09 FF');
    // "Hello wo" + "rld!" + non-printables.
    expect(row.ascii).toBe('Hello world!....');
  });

  it('formats a short trailing row without padding the hex column', () => {
    const bytes = new Uint8Array([0x68, 0x65, 0x6c]);
    const row = formatHexRow(bytes, 0);
    expect(row.offset).toBe('00000000');
    expect(row.hex).toBe('68 65 6C');
    expect(row.ascii).toBe('hel');
  });

  it('respects the rowStart offset in the rendered offset column', () => {
    const bytes = new Uint8Array(48);
    const row = formatHexRow(bytes, 32);
    expect(row.offset).toBe('00000020');
  });

  it('preserves the half-row gap on a row that has at least one byte in the right group', () => {
    const bytes = new Uint8Array(BYTES_PER_HEX_ROW);
    bytes[BYTES_PER_HEX_ROW - 1] = 0xab;
    const row = formatHexRow(bytes, 0);
    // 8 zero pairs + double-space + 7 zero pairs + AB
    expect(row.hex.split('  ')).toHaveLength(2);
    expect(row.hex.endsWith('AB')).toBe(true);
  });
});

describe('rowCountForByteLength', () => {
  it('returns 0 for an empty buffer', () => {
    expect(rowCountForByteLength(0)).toBe(0);
  });

  it('returns 1 for any non-empty buffer up to BYTES_PER_HEX_ROW', () => {
    expect(rowCountForByteLength(1)).toBe(1);
    expect(rowCountForByteLength(BYTES_PER_HEX_ROW)).toBe(1);
  });

  it('rounds up partial rows', () => {
    expect(rowCountForByteLength(BYTES_PER_HEX_ROW + 1)).toBe(2);
    expect(rowCountForByteLength(BYTES_PER_HEX_ROW * 2 + 5)).toBe(3);
  });
});
