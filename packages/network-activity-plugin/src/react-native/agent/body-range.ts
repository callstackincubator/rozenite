/**
 * Byte-range reads for captured bodies (ADR 0004, decision 7).
 *
 * Runs on the device (Hermes), so it counts UTF-8 bytes by hand rather than
 * relying on `TextEncoder` or `Buffer`.
 */
export const DEFAULT_BODY_MAX_BYTES = 16_384;

export type BodyRangeArgs = {
  offset?: number;
  maxBytes?: number;
};

export type BodyRange = {
  /** Size of the whole body in bytes. */
  totalBytes: number;
  /** Whether bytes after this range were left out. */
  truncated: boolean;
  /** Where the next range starts, when `truncated`. */
  nextOffset?: number;
};

const assertNonNegativeInteger = (value: unknown, name: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`"${name}" must be a non-negative integer.`);
  }
  return value;
};

export const normalizeBodyRangeArgs = (args: BodyRangeArgs = {}) => {
  const offset = args.offset === undefined ? 0 : assertNonNegativeInteger(args.offset, 'offset');
  const maxBytes =
    args.maxBytes === undefined
      ? DEFAULT_BODY_MAX_BYTES
      : assertNonNegativeInteger(args.maxBytes, 'maxBytes');
  if (maxBytes === 0) {
    throw new Error('"maxBytes" must be a positive integer.');
  }
  return { offset, maxBytes };
};

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
): BodyRange & { text: string } => {
  const end = offset + maxBytes;
  let position = 0;
  let startIndex = -1;
  let endIndex = text.length;
  let endPosition = -1;

  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index) ?? 0;
    const units = codePoint > 0xffff ? 2 : 1;

    if (startIndex === -1 && position >= offset) {
      startIndex = index;
    }
    if (endIndex === text.length && position >= end) {
      endIndex = index;
      endPosition = position;
    }

    position += codePointByteLength(codePoint);
    index += units;
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

type BodyResultLike = {
  available: boolean;
  body?: string;
};

/**
 * Narrows an available body to the requested byte range and reports
 * `totalBytes`, `truncated` and `nextOffset`, like the built-in `network`
 * domain. Unavailable bodies pass through.
 */
export const applyBodyRange = <TResult extends BodyResultLike>(
  result: TResult,
  args: BodyRangeArgs = {},
): TResult & Partial<BodyRange> => {
  const { offset, maxBytes } = normalizeBodyRangeArgs(args);
  if (!result.available || typeof result.body !== 'string') {
    return result;
  }

  const { text, ...range } = sliceUtf8(result.body, offset, maxBytes);
  return { ...result, body: text, ...range };
};
