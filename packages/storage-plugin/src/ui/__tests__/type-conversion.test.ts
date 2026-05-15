import { describe, expect, it } from 'vitest';
import { convertValue, defaultValueForType } from '../type-conversion';

describe('convertValue', () => {
  it('returns the same value when from === to', () => {
    expect(convertValue('string', 'string', 'hello')).toBe('hello');
    expect(convertValue('number', 'number', 42)).toBe(42);
    expect(convertValue('boolean', 'boolean', true)).toBe(true);
    expect(convertValue('buffer', 'buffer', [1, 2, 3])).toEqual([1, 2, 3]);
  });

  describe('from string', () => {
    it('parses a numeric string to a number, falls back to 0 on NaN', () => {
      expect(convertValue('string', 'number', '42')).toBe(42);
      expect(convertValue('string', 'number', '-3.14')).toBe(-3.14);
      expect(convertValue('string', 'number', 'abc')).toBe(0);
      expect(convertValue('string', 'number', '')).toBe(0);
    });

    it('parses "true" / anything-else to a boolean', () => {
      expect(convertValue('string', 'boolean', 'true')).toBe(true);
      expect(convertValue('string', 'boolean', 'false')).toBe(false);
      expect(convertValue('string', 'boolean', 'anything')).toBe(false);
      expect(convertValue('string', 'boolean', '')).toBe(false);
    });

    it('UTF-8 encodes a string to a byte array', () => {
      expect(convertValue('string', 'buffer', 'hello')).toEqual([
        0x68, 0x65, 0x6c, 0x6c, 0x6f,
      ]);
      // 'é' is two bytes in UTF-8: 0xC3 0xA9.
      expect(convertValue('string', 'buffer', 'café')).toEqual([
        0x63, 0x61, 0x66, 0xc3, 0xa9,
      ]);
      expect(convertValue('string', 'buffer', '')).toEqual([]);
    });
  });

  describe('from number', () => {
    it('stringifies a number when converting to string', () => {
      expect(convertValue('number', 'string', 42)).toBe('42');
      expect(convertValue('number', 'string', -3.14)).toBe('-3.14');
      expect(convertValue('number', 'string', 0)).toBe('0');
    });

    it('non-zero is truthy, zero is falsy for boolean conversion', () => {
      expect(convertValue('number', 'boolean', 1)).toBe(true);
      expect(convertValue('number', 'boolean', -1)).toBe(true);
      expect(convertValue('number', 'boolean', 0)).toBe(false);
    });

    it('UTF-8 encodes the stringified number to buffer', () => {
      expect(convertValue('number', 'buffer', 42)).toEqual([0x34, 0x32]);
    });
  });

  describe('from boolean', () => {
    it('stringifies to "true" / "false"', () => {
      expect(convertValue('boolean', 'string', true)).toBe('true');
      expect(convertValue('boolean', 'string', false)).toBe('false');
    });

    it('true → 1, false → 0 for number conversion', () => {
      expect(convertValue('boolean', 'number', true)).toBe(1);
      expect(convertValue('boolean', 'number', false)).toBe(0);
    });

    it('encodes the literal "true" / "false" bytes for buffer conversion', () => {
      expect(convertValue('boolean', 'buffer', true)).toEqual([
        0x74, 0x72, 0x75, 0x65,
      ]);
      expect(convertValue('boolean', 'buffer', false)).toEqual([
        0x66, 0x61, 0x6c, 0x73, 0x65,
      ]);
    });
  });

  describe('from buffer', () => {
    it('UTF-8 decodes bytes back to a string (the headline round-trip)', () => {
      expect(
        convertValue('buffer', 'string', [0x68, 0x65, 0x6c, 0x6c, 0x6f]),
      ).toBe('hello');
    });

    it('returns an empty string when bytes are not valid UTF-8', () => {
      expect(convertValue('buffer', 'string', [0xff, 0xfe, 0xfd])).toBe('');
    });

    it('decodes then parses to number, falls back to 0 on failure', () => {
      expect(convertValue('buffer', 'number', [0x34, 0x32])).toBe(42); // "42"
      expect(
        convertValue('buffer', 'number', [0x68, 0x65, 0x6c, 0x6c, 0x6f]),
      ).toBe(0); // "hello" → NaN → 0
      expect(convertValue('buffer', 'number', [0xff])).toBe(0); // invalid UTF-8 → 0
    });

    it('decodes then matches "true" for boolean conversion', () => {
      expect(convertValue('buffer', 'boolean', [0x74, 0x72, 0x75, 0x65])).toBe(
        true,
      );
      expect(
        convertValue('buffer', 'boolean', [0x66, 0x61, 0x6c, 0x73, 0x65]),
      ).toBe(false);
      expect(convertValue('buffer', 'boolean', [0xff])).toBe(false);
    });
  });

  it('round-trips string ↔ buffer faithfully', () => {
    const original = 'Hello, world! — 你好';
    const bytes = convertValue('string', 'buffer', original) as number[];
    const back = convertValue('buffer', 'string', bytes);
    expect(back).toBe(original);
  });
});

describe('defaultValueForType', () => {
  it('returns sensible zero values', () => {
    expect(defaultValueForType('string')).toBe('');
    expect(defaultValueForType('number')).toBe(0);
    expect(defaultValueForType('boolean')).toBe(false);
    expect(defaultValueForType('buffer')).toEqual([]);
  });
});
