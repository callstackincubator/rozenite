import { hashFilters } from '../pagination/filters-hash.js';

export const DEFAULT_REACT_PAGE_LIMIT = 20;
export const MAX_REACT_PAGE_LIMIT = 100;

/**
 * The React domain keeps its own cursor rather than using the shared one from
 * `../pagination/cursor.js`.
 *
 * The shared cursor is a position over an append-only log, where replaying it
 * under different filters is well defined. React's lists are not logs: they are
 * derived on every call from a tree that remounts, or from a profiling session
 * that is replaced wholesale on the next `startProfiling`. An offset into "the
 * children of node 12" means nothing against "the results of searching Button",
 * so the cursor carries what it is a position *in* and refuses to be read under
 * anything else.
 */
interface ReactCursorPayload {
  v: 1;
  tool: string;
  deviceId: string;
  offset: number;
  filtersHash: string;
}

export interface ReactPage {
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}

const encodeCursor = (payload: ReactCursorPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const decodeCursor = (raw: string): ReactCursorPayload => {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as ReactCursorPayload;
    if (
      payload.v !== 1 ||
      typeof payload.tool !== 'string' ||
      typeof payload.deviceId !== 'string' ||
      !Number.isInteger(payload.offset) ||
      payload.offset < 0 ||
      typeof payload.filtersHash !== 'string'
    ) {
      throw new Error('Invalid cursor payload');
    }

    return payload;
  } catch {
    throw new Error(
      'Invalid "cursor". Run the command again without cursor to restart pagination.',
    );
  }
};

export const normalizeReactLimit = (value: unknown): number => {
  if (value === undefined) {
    return DEFAULT_REACT_PAGE_LIMIT;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`"limit" must be an integer between 1 and ${MAX_REACT_PAGE_LIMIT}`);
  }

  return Math.min(parsed, MAX_REACT_PAGE_LIMIT);
};

/**
 * Slice one page out of an already-materialised, deterministically ordered list.
 *
 * Every React list tool builds its full result set first — the trees and
 * profiling sessions involved are small enough that the alternative, seeking
 * through a data structure the caller cannot observe, would buy nothing but a
 * second ordering to keep in sync with the cursor.
 */
export const paginateReactList = <TItem>(input: {
  deviceId: string;
  tool: string;
  /** Everything that changes the list's contents or order. */
  filters: unknown;
  limit: unknown;
  cursor: unknown;
  items: TItem[];
}): { items: TItem[]; totalCount: number; page: ReactPage } => {
  const limit = normalizeReactLimit(input.limit);
  const filtersHash = hashFilters(input.filters);

  let offset = 0;
  if (typeof input.cursor === 'string' && input.cursor.trim().length > 0) {
    const decoded = decodeCursor(input.cursor);
    if (
      decoded.deviceId !== input.deviceId ||
      decoded.tool !== input.tool ||
      decoded.filtersHash !== filtersHash
    ) {
      throw new Error(
        'Cursor does not match this request context. Restart pagination without cursor.',
      );
    }
    offset = decoded.offset;
  }

  const totalCount = input.items.length;
  const start = Math.max(0, Math.min(offset, totalCount));
  const end = Math.min(start + limit, totalCount);
  const hasMore = end < totalCount;

  return {
    items: input.items.slice(start, end),
    totalCount,
    page: {
      limit,
      hasMore,
      ...(hasMore
        ? {
            nextCursor: encodeCursor({
              v: 1,
              tool: input.tool,
              deviceId: input.deviceId,
              offset: end,
              filtersHash,
            }),
          }
        : {}),
    },
  };
};
