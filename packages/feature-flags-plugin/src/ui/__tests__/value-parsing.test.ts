import { describe, expect, it } from 'vitest';
import { parseJsonInput, parseNumberInput } from '../value-parsing';

describe('parseNumberInput', () => {
  it('parses a valid number', () => {
    expect(parseNumberInput('42')).toEqual({ ok: true, value: 42 });
    expect(parseNumberInput('-3.5')).toEqual({ ok: true, value: -3.5 });
  });

  it('trims surrounding whitespace', () => {
    expect(parseNumberInput('  7  ')).toEqual({ ok: true, value: 7 });
  });

  it('rejects empty input instead of coercing it to 0', () => {
    const result = parseNumberInput('');
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric input rather than producing NaN', () => {
    const result = parseNumberInput('not-a-number');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });
});

describe('parseJsonInput', () => {
  it('parses a valid JSON object', () => {
    expect(parseJsonInput('{"a": 1, "b": [true, null]}')).toEqual({
      ok: true,
      value: { a: 1, b: [true, null] },
    });
  });

  it('parses JSON primitives', () => {
    expect(parseJsonInput('42')).toEqual({ ok: true, value: 42 });
    expect(parseJsonInput('"hello"')).toEqual({ ok: true, value: 'hello' });
  });

  it('rejects invalid JSON with a visible message', () => {
    const result = parseJsonInput('{not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('rejects JSON containing undefined-shaped values', () => {
    // JSON.parse itself can never produce `undefined`, but this exercises
    // the isValueOfType('json', ...) guard rather than assuming JSON.parse
    // is the only source of truth.
    const result = parseJsonInput('undefined');
    expect(result.ok).toBe(false);
  });
});
