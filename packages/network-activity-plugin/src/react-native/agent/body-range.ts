/**
 * Byte-range reads for captured bodies (ADR 0004, decision 7), cut by the
 * shared `sliceUtf8` so `offset`/`nextOffset` mean the same as in the
 * built-in `network` domain.
 */
import { sliceUtf8 } from '@rozenite/agent-shared';

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

  const { slice, ...range } = sliceUtf8(result.body, { offset, maxBytes });
  return { ...result, body: slice, ...range };
};
