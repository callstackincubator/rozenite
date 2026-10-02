import { describe, expect, it } from 'vitest';
import { getErrorDetails } from '../errors.js';

describe('getErrorDetails', () => {
  it('returns null for falsy input', () => {
    expect(getErrorDetails(undefined)).toBeNull();
    expect(getErrorDetails(null)).toBeNull();
    expect(getErrorDetails('')).toBeNull();
  });

  it('uses the message of an Error', () => {
    expect(getErrorDetails(new Error('boom'))).toBe('boom');
  });

  it('stringifies non-Error values', () => {
    expect(getErrorDetails('nope')).toBe('nope');
    expect(getErrorDetails(42)).toBe('42');
  });

  it('joins the members of an AggregateError', () => {
    const error = new AggregateError([new Error('ECONNREFUSED ::1'), 'plain', 7], 'outer');
    expect(getErrorDetails(error)).toBe('ECONNREFUSED ::1; plain; 7');
  });

  it('falls back to the message of an empty AggregateError', () => {
    expect(getErrorDetails(new AggregateError([], 'outer'))).toBe('outer');
  });
});
