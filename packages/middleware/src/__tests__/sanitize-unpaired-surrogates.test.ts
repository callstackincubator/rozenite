import { describe, expect, it } from 'vitest';
import { sanitizeUnpairedSurrogates } from '../agent/session.js';

// `sanitizeUnpairedSurrogates` operates on the *output* of `JSON.stringify`, not
// on a raw JS string. Modern (ES2019+ "well-formed") `JSON.stringify` never emits
// a lone surrogate as a raw UTF-16 code unit -- it always escapes it to a literal
// six-character `\uXXXX` sequence. So the function has to look for that escape
// sequence text, not for raw surrogate code units (which, for a lone surrogate,
// will never appear post-stringify). These tests build inputs the way the real
// call sites do: `JSON.stringify(...)` first, then sanitize the result.

describe('sanitizeUnpairedSurrogates', () => {
  it('leaves ordinary ASCII/BMP text untouched', () => {
    const input = JSON.stringify('He said "hi"\nnewline\ttab \\backslash');
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('preserves valid surrogate pairs (e.g. emoji), which JSON.stringify never escapes', () => {
    const input = JSON.stringify('party 🎉 time 👋🏽 done');
    // Emoji survive JSON.stringify as raw UTF-16 code units, not `\u` escapes --
    // confirm the fixture actually exercises that (otherwise this test would
    // pass trivially even if the sanitizer corrupted emoji).
    expect(input).not.toMatch(/\\u[dD][89a-fA-F]/);
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('does not mangle U+2028 or U+2029 (JSON.stringify does not escape them either)', () => {
    const input = JSON.stringify('line  separator and paragraph  separator');
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('replaces an unpaired high-surrogate escape sequence produced by JSON.stringify', () => {
    const input = JSON.stringify('broken \uD800 surrogate');
    expect(input).toContain('\\ud800');
    const result = sanitizeUnpairedSurrogates(input);
    expect(result).not.toContain('\\ud800');
    expect(result).toBe(JSON.stringify('broken � surrogate'));
  });

  it('replaces an unpaired low-surrogate escape sequence produced by JSON.stringify', () => {
    const input = JSON.stringify('broken \uDC00 surrogate');
    expect(input).toContain('\\udc00');
    const result = sanitizeUnpairedSurrogates(input);
    expect(result).not.toContain('\\udc00');
    expect(result).toBe(JSON.stringify('broken � surrogate'));
  });

  it('replaces two consecutive unpaired high-surrogate escape sequences independently', () => {
    const input = JSON.stringify('\uD800\uD800');
    const result = sanitizeUnpairedSurrogates(input);
    expect(result).toBe(JSON.stringify('��'));
  });

  it('replaces an unpaired high-surrogate escape sequence at the end of the string', () => {
    const input = JSON.stringify('trailing \uD800');
    const result = sanitizeUnpairedSurrogates(input);
    expect(result).toBe(JSON.stringify('trailing �'));
  });

  it('leaves a valid surrogate pair escape sequence untouched (should one ever appear)', () => {
    // JSON.stringify does not normally escape a *paired* surrogate -- it only
    // escapes an unpaired half -- but the sanitizer must not corrupt a valid pair
    // if it ever encounters one already in escape-sequence form.
    const input = '"before \\ud83c\\udf89 after"';
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });

  it('reproduces the real device failure and confirms the fix: makes JSON.stringify output safe for a strict receiver', () => {
    // Empirically, a downstream JSON parser (the CDP relay / device) rejects an
    // unpaired `\uXXXX` surrogate escape even though it is syntactically valid
    // JSON text -- reproduced against a real device during development of this
    // fix ("json parse error ... expected another unicode escape for second half
    // of surrogate pair"). After sanitizing, no such escape sequence remains.
    const message = { pluginId: 'p', payload: { value: 'before-\uD800-after' } };
    const serialized = JSON.stringify(message);
    expect(serialized).toMatch(/\\u[dD]8/);

    const sanitized = sanitizeUnpairedSurrogates(serialized);
    expect(sanitized).not.toMatch(/\\u[dD][89a-fA-F][0-9a-fA-F]{2}\\u[dD][c-fC-F]/);
    expect(sanitized).not.toContain('\\ud800');
    expect(() => JSON.parse(sanitized)).not.toThrow();
    expect(JSON.parse(sanitized).payload.value).toBe('before-�-after');
  });

  it('preserves a message containing both a valid emoji and an unpaired surrogate, mangling only the latter', () => {
    const input = JSON.stringify('ok 🎉 but also \uD800 broken');
    const result = sanitizeUnpairedSurrogates(input);
    expect(result).toBe(JSON.stringify('ok 🎉 but also � broken'));
  });

  it('is a no-op (returns the identical reference-equal-in-value input) when there is nothing to sanitize', () => {
    const input = JSON.stringify({ ok: true, emoji: '🎉' });
    expect(sanitizeUnpairedSurrogates(input)).toBe(input);
  });
});
