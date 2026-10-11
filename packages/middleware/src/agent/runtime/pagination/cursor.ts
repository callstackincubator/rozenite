import { PaginationError } from './errors.js';

/**
 * A console cursor is the `seq` of a row: the 1-based position of that entry in
 * the device's append-only log.
 *
 * It carries no filters, no order, and no owning tool or device. Positions are
 * absolute indices over an append-only log, so reusing one under a different
 * query is well defined — "resume here, matching these filters instead" — rather
 * than corrupting, which is what offset pagination would risk.
 *
 * The one thing validation could still have caught is a position replayed
 * against another device. That now resolves in the target device's own position
 * space and returns a well-formed but likely unintended slice, silently. It is a
 * deliberate mistake to make, the damage is bounded, and every row carries its
 * `seq` — so the context that used to ride along cost more than the mistake it
 * prevented.
 *
 * Because the cursor is the `seq`, one column serves as a row's identity, as
 * the cursor that resumes after it, and as a `before`/`after` anchor. Earlier
 * releases handed out the 0-based position base64url-encoded; those cursors are
 * still read so a listing paged across an upgrade keeps working.
 */

/** `seq` is the log position shifted so the first entry reads as 1 rather than 0. */
export const SEQ_OFFSET = 1;

export const encodeCursor = (position: number): string => {
  return String(position + SEQ_OFFSET);
};

const SEQ_PATTERN = /^\d+$/;

const readPosition = (raw: string | number): number | undefined => {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw >= SEQ_OFFSET ? raw - SEQ_OFFSET : undefined;
  }

  const trimmed = raw.trim();
  if (SEQ_PATTERN.test(trimmed)) {
    const seq = Number(trimmed);
    return Number.isSafeInteger(seq) && seq >= SEQ_OFFSET ? seq - SEQ_OFFSET : undefined;
  }

  // Legacy cursor: the 0-based position, base64url-encoded. Base64 of a digit
  // string always starts with "M", so it can never be mistaken for a seq.
  const decoded = Buffer.from(trimmed, 'base64url').toString('utf8');
  if (!SEQ_PATTERN.test(decoded)) {
    return undefined;
  }

  const position = Number(decoded);
  return Number.isSafeInteger(position) ? position : undefined;
};

export const decodeCursor = (
  raw: string | number,
  /** Names the offending argument, since positional args share this decoder. */
  field = 'cursor',
): number => {
  const position = readPosition(raw);

  if (position === undefined) {
    throw new PaginationError(
      'PAGINATION_INVALID_CURSOR',
      field === 'cursor'
        ? 'Invalid "cursor". Run the command again without cursor to restart pagination.'
        : `Invalid "${field}". Pass the "seq" of an item from a previous response.`,
    );
  }

  return position;
};

/** True when a request field carries a cursor at all (a seq number or a non-empty string). */
export const hasCursorValue = (value: unknown): value is string | number => {
  return (
    (typeof value === 'string' && value.trim().length > 0) ||
    (typeof value === 'number' && !Number.isNaN(value))
  );
};
