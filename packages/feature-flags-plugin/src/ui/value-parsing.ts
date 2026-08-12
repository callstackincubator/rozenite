import { isValueOfType } from '../shared/types';

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Parses a number-typed flag's inline input. Rejects empty input, `NaN`,
 * and non-numeric strings rather than silently coercing them (a bare
 * `Number(...)` would turn `''` into `0`, which is exactly the "sends NaN
 * or a made-up value" failure this exists to prevent).
 */
export const parseNumberInput = (raw: string): ParseResult<number> => {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { ok: false, error: 'Enter a number.' };
  }

  const value = Number(trimmed);

  if (Number.isNaN(value)) {
    return { ok: false, error: 'Not a valid number.' };
  }

  return { ok: true, value };
};

/**
 * Parses a json-typed flag's editor input. Rejects invalid JSON and JSON
 * that parses but isn't a `JsonValue` (e.g. contains `undefined` via a
 * pathological `JSON.parse` reviver — defensive, but cheap to check).
 */
export const parseJsonInput = (raw: string): ParseResult<unknown> => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Invalid JSON.' };
  }

  if (!isValueOfType('json', parsed)) {
    return { ok: false, error: 'Value is not valid JSON.' };
  }

  return { ok: true, value: parsed };
};
