/**
 * Byte-range reads of text (ADR 0004, decision 7). Runs on the device, so
 * it counts UTF-8 bytes by hand rather than using `TextEncoder` or `Buffer`.
 */

const codePointByteLength = (codePoint: number): number => {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

/**
 * Returns the code points of `text` whose first UTF-8 byte falls in
 * `[offset, offset + maxBytes)`. Ranges with consecutive offsets therefore
 * partition the text exactly, never splitting or repeating a character; a
 * range may run up to three bytes past `maxBytes` to finish its last
 * character.
 */
export const sliceUtf8 = (
  text: string,
  offset: number,
  maxBytes: number,
): { text: string; totalBytes: number; truncated: boolean; nextOffset?: number } => {
  const end = offset + maxBytes;
  let position = 0;
  let startIndex = -1;
  let endIndex = text.length;
  let endPosition = -1;

  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index) ?? 0;

    if (startIndex === -1 && position >= offset) {
      startIndex = index;
    }
    if (endIndex === text.length && position >= end) {
      endIndex = index;
      endPosition = position;
    }

    position += codePointByteLength(codePoint);
    index += codePoint > 0xffff ? 2 : 1;
  }

  if (startIndex === -1) {
    return { text: '', totalBytes: position, truncated: false };
  }

  const truncated = endIndex < text.length;
  return {
    text: text.slice(startIndex, endIndex),
    totalBytes: position,
    truncated,
    ...(truncated ? { nextOffset: endPosition } : {}),
  };
};

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
