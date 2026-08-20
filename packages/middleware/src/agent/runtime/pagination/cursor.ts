import { PaginationError } from './errors.js';

/**
 * A cursor is one position, encoded so callers do not build on its shape.
 *
 * It carries no filters, no order, and no owning tool or device. Positions are
 * absolute indices over an append-only log, so reusing one under a different
 * query is well defined — "resume here, matching these filters instead" — rather
 * than corrupting, which is what offset pagination would risk.
 *
 * The one thing validation could still have caught is a position replayed
 * against another device. That now resolves in the target device's own position
 * space and returns a well-formed but likely unintended slice, silently. It is a
 * deliberate mistake to make, the damage is bounded, and every row carries a
 * cursor — so the context that used to ride along cost more than the mistake it
 * prevented.
 *
 * The base64 is discipline, not secrecy — trivially reversible, and only there
 * so clients treat the value as opaque and the encoding stays ours to change.
 */
export const encodeCursor = (position: number): string => {
  return Buffer.from(String(position), 'utf8').toString('base64url');
};

export const decodeCursor = (
  raw: string,
  /** Names the offending argument, since positional args share this decoder. */
  field = 'cursor',
): number => {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const position = Number(decoded);

  if (decoded.trim().length === 0 || !Number.isSafeInteger(position) || position < 0) {
    throw new PaginationError(
      'PAGINATION_INVALID_CURSOR',
      field === 'cursor'
        ? 'Invalid "cursor". Run the command again without cursor to restart pagination.'
        : `Invalid "${field}". Pass a cursor from an item or page in a previous response.`,
    );
  }

  return position;
};
