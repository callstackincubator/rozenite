/**
 * Byte-range reads of text for bounded body and file reads (ADR 0004,
 * decision 7). One implementation for the built-in `network` domain and the
 * official plugins, so `offset`/`nextOffset` mean the same thing everywhere.
 *
 * Runs in Node, the browser, Hermes and Lynx: it counts UTF-8 bytes by hand
 * and uses no `Buffer`, `node:` import or `TextEncoder`.
 */

export type SliceUtf8Options = {
  /** Byte index to start at. Defaults to 0. */
  offset?: number;
  /** Most bytes to return. Must be at least 1. */
  maxBytes: number;
};

export type SliceUtf8Result = {
  /** The returned text. */
  slice: string;
  /** Size of the whole text in UTF-8 bytes. */
  totalBytes: number;
  /** Whether bytes after `slice` were left out. */
  truncated: boolean;
  /**
   * Byte index of the first byte not returned; pass it back as `offset` to
   * read on. Present only when `truncated`.
   */
  nextOffset?: number;
};

/** UTF-8 length of one code point; a lone surrogate counts as U+FFFD. */
const utf8Length = (codePoint: number): number => {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x10000) return 3;
  return 4;
};

/**
 * Cuts `[offset, offset + maxBytes)` out of `text`, counting UTF-8 bytes,
 * without ever splitting a character (a multi-byte UTF-8 sequence, and so
 * never a UTF-16 surrogate pair):
 *
 * - **Start.** An `offset` inside a character moves forward to the start of
 *   the next one. An `offset` at or past the end returns an empty slice.
 * - **End.** The slice holds the whole characters that fit in `maxBytes`
 *   bytes from the start; a character that would cross the limit is left for
 *   the next range. The one exception: when the first character alone is
 *   longer than `maxBytes`, it is returned whole, so every read makes
 *   progress.
 * - **Next.** `nextOffset` is the byte index of the first byte not returned,
 *   so consecutive reads that pass it back as `offset` partition the text
 *   exactly, never repeating or skipping a byte.
 */
export const sliceUtf8 = (text: string, options: SliceUtf8Options): SliceUtf8Result => {
  const offset = options.offset ?? 0;
  const { maxBytes } = options;
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('"offset" must be a non-negative integer.');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error('"maxBytes" must be a positive integer.');
  }

  let position = 0;
  let startIndex = -1;
  let startPosition = 0;
  let endIndex = -1;
  let endPosition = 0;

  for (let index = 0; index < text.length;) {
    const codePoint = text.codePointAt(index)!;
    const units = codePoint > 0xffff ? 2 : 1;
    const bytes = utf8Length(codePoint);

    if (startIndex === -1 && position >= offset) {
      startIndex = index;
      startPosition = position;
    }
    if (startIndex !== -1 && endIndex === -1) {
      const fits = position + bytes - startPosition <= maxBytes;
      const first = index === startIndex;
      if (!fits && !first) {
        endIndex = index;
        endPosition = position;
      }
    }

    position += bytes;
    index += units;
  }

  if (startIndex === -1) {
    return { slice: '', totalBytes: position, truncated: false };
  }
  if (endIndex === -1) {
    return {
      slice: startIndex === 0 ? text : text.slice(startIndex),
      totalBytes: position,
      truncated: false,
    };
  }

  return {
    slice: text.slice(startIndex, endIndex),
    totalBytes: position,
    truncated: true,
    nextOffset: endPosition,
  };
};
