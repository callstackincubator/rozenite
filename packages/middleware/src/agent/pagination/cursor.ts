import { createHash } from 'node:crypto';
import { PaginationError } from './errors.js';
import type { CursorPayload, PageOrder } from './types.js';

type CompactCursorPayload<TPosition> = {
  v: 1;
  t: string;
  d: string;
  p: TPosition;
  f: string;
  o: PageOrder;
};

type ComparableValue =
  | null
  | boolean
  | number
  | string
  | ComparableValue[]
  | { [key: string]: ComparableValue };

const normalizeForHash = (value: unknown): ComparableValue => {
  if (
    value === null
    || typeof value === 'boolean'
    || typeof value === 'number'
    || typeof value === 'string'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeForHash(item));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, normalizeForHash(nested)] as const);

    return Object.fromEntries(entries);
  }

  return String(value);
};

export const hashFilters = (filters: unknown): string => {
  const normalized = normalizeForHash(filters ?? {});
  const raw = JSON.stringify(normalized);
  return createHash('sha1').update(raw).digest('hex');
};

export const encodeCursor = <TPosition>(payload: CursorPayload<TPosition>): string => {
  const compact: CompactCursorPayload<TPosition> = {
    v: payload.v,
    t: payload.tool,
    d: payload.deviceId,
    p: payload.position,
    f: payload.filtersHash,
    o: payload.order,
  };

  return Buffer.from(JSON.stringify(compact), 'utf8').toString('base64url');
};

export const decodeCursor = <TPosition>(raw: string): CursorPayload<TPosition> => {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as CompactCursorPayload<TPosition>;
    const payload: CursorPayload<TPosition> = {
      v: parsed.v,
      tool: parsed.t,
      deviceId: parsed.d,
      position: parsed.p,
      filtersHash: parsed.f,
      order: parsed.o,
    };
    if (
      payload.v !== 1
      || typeof payload.tool !== 'string'
      || typeof payload.deviceId !== 'string'
      || (payload.order !== 'asc' && payload.order !== 'desc')
      || typeof payload.filtersHash !== 'string'
      || payload.position === undefined
    ) {
      throw new Error('Invalid cursor payload');
    }

    return payload;
  } catch {
    throw new PaginationError(
      'PAGINATION_INVALID_CURSOR',
      'Invalid "cursor". Run the command again without cursor to restart pagination.',
    );
  }
};

export const validateCursorContext = (
  payload: CursorPayload<unknown>,
  expected: {
    tool: string;
    deviceId: string;
    filtersHash: string;
    order: PageOrder;
  },
): void => {
  if (
    payload.tool !== expected.tool
    || payload.deviceId !== expected.deviceId
    || payload.filtersHash !== expected.filtersHash
    || payload.order !== expected.order
  ) {
    throw new PaginationError(
      'PAGINATION_CURSOR_MISMATCH',
      'Cursor does not match this request context. Restart pagination without cursor.',
    );
  }
};
