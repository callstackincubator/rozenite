/**
 * Byte-count helpers for bounded file reads (ADR 0004, decision 7). Text
 * ranges are cut by `sliceUtf8` from `@rozenite/agent-shared`.
 */

/** Decoded size of a base64 string, without decoding it. */
export const base64DecodedLength = (base64: string): number => {
  const trimmed = base64.replace(/\s+/g, '');
  const padding = trimmed.endsWith('==') ? 2 : trimmed.endsWith('=') ? 1 : 0;
  return Math.floor((trimmed.length * 3) / 4) - padding;
};

export const normalizeByteArg = (
  value: unknown,
  name: string,
  fallback: number,
  { min = 1, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`"${name}" must be an integer of at least ${min}.`);
  }
  if (value > max) {
    throw new Error(`"${name}" must be at most ${max}.`);
  }
  return value;
};
