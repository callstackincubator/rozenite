import { describe, expect, it } from 'vitest';
import {
  base64ToBytes,
  bytesToAsciiPreview,
  bytesToBase64,
  bytesToGroupedHex,
  bytesToHexdump,
  compactBufferPreview,
  hexInputToBytes,
} from '../binary';

// 0x89 'P' 'N' 'G' \r \n 0x1A \n - the canonical PNG signature.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

describe('bytesToGroupedHex', () => {
  it('returns empty string for empty bytes', () => {
    expect(bytesToGroupedHex([])).toBe('');
  });

  it('groups under 8 bytes without a double-space separator', () => {
    expect(bytesToGroupedHex([0x89, 0x50])).toBe('89 50');
  });

  it('inserts a double-space gap between bytes 8 and 9', () => {
    expect(
      bytesToGroupedHex([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
      ]),
    ).toBe('89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52');
  });

  it('wraps after 16 bytes with a newline', () => {
    const bytes = new Array(20).fill(0xff);
    const out = bytesToGroupedHex(bytes);
    const lines = out.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('FF FF FF FF FF FF FF FF  FF FF FF FF FF FF FF FF');
    expect(lines[1]).toBe('FF FF FF FF');
  });
});

describe('bytesToHexdump', () => {
  it('renders offset, grouped hex, and ASCII column', () => {
    const bytes = [
      ...PNG_SIGNATURE,
      0x00,
      0x00,
      0x00,
      0x0d,
      0x49,
      0x48,
      0x44,
      0x52,
    ];
    expect(bytesToHexdump(bytes)).toBe(
      '00000000  89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52  |.PNG........IHDR|',
    );
  });

  it('uses lowercase 8-digit offsets that increment by 16', () => {
    const bytes = new Array(20).fill(0x41);
    const lines = bytesToHexdump(bytes).split('\n');
    expect(lines[0].startsWith('00000000  ')).toBe(true);
    expect(lines[1].startsWith('00000010  ')).toBe(true);
  });

  it('pads the hex column on a partial trailing line so ASCII aligns', () => {
    const bytes = [0x41, 0x42, 0x43];
    const line = bytesToHexdump(bytes);
    // Hex section width must be exactly 48 chars before the "  |..." block.
    expect(line).toBe(
      '00000000  41 42 43                                          |ABC|',
    );
  });

  it('renders non-printable bytes as dots in the ASCII column', () => {
    const bytes = [0x00, 0x09, 0x1f, 0x20, 0x7e, 0x7f, 0xff];
    expect(bytesToHexdump(bytes)).toContain('|... ~..|');
  });
});

describe('bytesToAsciiPreview', () => {
  it('maps printable bytes to characters', () => {
    expect(bytesToAsciiPreview([0x48, 0x69])).toBe('Hi');
  });

  it('treats bytes outside 0x20..0x7E as "."', () => {
    expect(bytesToAsciiPreview([0x1f, 0x20, 0x7e, 0x7f])).toBe('. ~.');
  });

  it('treats tab and newline as non-printable', () => {
    expect(bytesToAsciiPreview([0x09, 0x0a, 0x0d])).toBe('...');
  });
});

describe('bytesToBase64 / base64ToBytes round-trip', () => {
  it('encodes simple ASCII to base64 and back', () => {
    const bytes = [0x48, 0x65, 0x6c, 0x6c, 0x6f]; // "Hello"
    const encoded = bytesToBase64(bytes);
    expect(encoded).toBe('SGVsbG8=');
    const decoded = base64ToBytes(encoded);
    expect(decoded).toEqual({ ok: true, value: bytes });
  });

  it('round-trips arbitrary bytes including high values', () => {
    const bytes = [0x00, 0xff, 0x89, 0x50, 0x4e, 0x47];
    const decoded = base64ToBytes(bytesToBase64(bytes));
    expect(decoded).toEqual({ ok: true, value: bytes });
  });

  it('accepts base64 with surrounding and internal whitespace', () => {
    expect(base64ToBytes('  SGVs\nbG8=  ')).toEqual({
      ok: true,
      value: [0x48, 0x65, 0x6c, 0x6c, 0x6f],
    });
  });

  it('rejects empty input with the canonical message', () => {
    expect(base64ToBytes('')).toEqual({
      ok: false,
      error: 'Enter at least one byte.',
    });
    expect(base64ToBytes('   ')).toEqual({
      ok: false,
      error: 'Enter at least one byte.',
    });
  });

  it('rejects malformed base64', () => {
    expect(base64ToBytes('not*valid*base64')).toEqual({
      ok: false,
      error: 'Base64 input is invalid.',
    });
  });
});

describe('compactBufferPreview', () => {
  it('renders just the size for an empty buffer', () => {
    expect(compactBufferPreview([])).toBe('0 B');
  });

  it('omits the ellipsis when the buffer fits within maxBytes', () => {
    expect(compactBufferPreview([0x89, 0x50, 0x4e, 0x47])).toBe(
      '89 50 4E 47 4 B',
    );
  });

  it('includes an ellipsis when truncated', () => {
    expect(compactBufferPreview(new Array(128).fill(0xab))).toBe(
      'AB AB AB AB AB AB AB AB … 128 B',
    );
  });

  it('respects a custom maxBytes', () => {
    expect(compactBufferPreview([0x01, 0x02, 0x03], { maxBytes: 2 })).toBe(
      '01 02 … 3 B',
    );
  });
});

describe('hexInputToBytes', () => {
  it('parses continuous hex', () => {
    expect(hexInputToBytes('deadbeef')).toEqual({
      ok: true,
      value: [0xde, 0xad, 0xbe, 0xef],
    });
  });

  it('parses grouped hex', () => {
    expect(hexInputToBytes('DE AD BE EF')).toEqual({
      ok: true,
      value: [0xde, 0xad, 0xbe, 0xef],
    });
  });

  it('parses multiline grouped hex', () => {
    expect(
      hexInputToBytes(
        '89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52\n00 00 00 20 00 00 00 20',
      ),
    ).toEqual({
      ok: true,
      value: [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
      ],
    });
  });

  it('parses pasted hexdump rows, stripping offsets and ASCII column', () => {
    const pasted = [
      '00000000  89 50 4E 47 0D 0A 1A 0A  00 00 00 0D 49 48 44 52  |.PNG........IHDR|',
      '00000010  00 00 00 20 00 00 00 20  08 06 00 00 00 73 7A 7A  |... ... .....szz|',
    ].join('\n');
    expect(hexInputToBytes(pasted)).toEqual({
      ok: true,
      value: [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x00, 0x20,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x73, 0x7a, 0x7a,
      ],
    });
  });

  it('accepts colon-separated hexdump offsets', () => {
    expect(hexInputToBytes('00000000: 89 50 4E 47')).toEqual({
      ok: true,
      value: [0x89, 0x50, 0x4e, 0x47],
    });
  });

  it('strips "0x" prefixes', () => {
    expect(hexInputToBytes('0xDE 0xAD 0xBE 0xEF')).toEqual({
      ok: true,
      value: [0xde, 0xad, 0xbe, 0xef],
    });
  });

  it('tolerates mixed case', () => {
    expect(hexInputToBytes('De Ad bE eF')).toEqual({
      ok: true,
      value: [0xde, 0xad, 0xbe, 0xef],
    });
  });

  it('rejects empty input with the canonical message', () => {
    expect(hexInputToBytes('')).toEqual({
      ok: false,
      error: 'Enter at least one byte.',
    });
    expect(hexInputToBytes('   \n   ')).toEqual({
      ok: false,
      error: 'Enter at least one byte.',
    });
  });

  it('rejects non-hex characters', () => {
    expect(hexInputToBytes('DE AD GG')).toEqual({
      ok: false,
      error: 'Hex input contains invalid characters.',
    });
  });

  it('rejects odd hex digit count', () => {
    expect(hexInputToBytes('DEAD B')).toEqual({
      ok: false,
      error: 'Hex input must contain complete bytes.',
    });
  });
});
