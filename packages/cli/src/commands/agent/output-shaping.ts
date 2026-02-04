type CursorPayload = {
  v: 1;
  kind: 'tools' | 'domains';
  scope: string;
  index: number;
};

export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

const encodeCursor = (payload: CursorPayload): string => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

const decodeCursor = (raw: string): CursorPayload => {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as CursorPayload;
    if (
      payload.v !== 1 ||
      (payload.kind !== 'tools' && payload.kind !== 'domains') ||
      typeof payload.scope !== 'string' ||
      !Number.isInteger(payload.index) ||
      payload.index < 0
    ) {
      throw new Error('Invalid cursor payload');
    }
    return payload;
  } catch {
    throw new Error('Invalid --cursor. Run the listing command again with --limit 20.');
  }
};

export const parseFields = <T extends string>(
  rawFields: string | undefined,
  allowedFields: readonly T[],
  defaultFields: readonly T[],
  verbose: boolean,
): T[] => {
  if (verbose) {
    return [...allowedFields];
  }

  if (!rawFields || rawFields.trim().length === 0) {
    return [...defaultFields];
  }

  const requested = rawFields
    .split(',')
    .map((field) => field.trim())
    .filter(Boolean) as T[];

  if (requested.length === 0) {
    return [...defaultFields];
  }

  const allowedSet = new Set(allowedFields);
  const invalid = requested.filter((field) => !allowedSet.has(field));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown fields: ${invalid.join(', ')}. Allowed fields: ${allowedFields.join(', ')}`,
    );
  }

  return requested;
};

export const parseLimit = (rawLimit: string | undefined): number => {
  if (!rawLimit) {
    return DEFAULT_PAGE_LIMIT;
  }

  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) {
    throw new Error(`--limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
};

export const projectRows = <T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
): Record<string, unknown>[] => {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      if (Object.hasOwn(row, field)) {
        projected[field] = row[field];
      }
    }
    return projected;
  });
};

export const paginateRows = <T>(
  rows: T[],
  options: {
    kind: 'tools' | 'domains';
    scope: string;
    limit: number;
    cursor?: string;
  },
): {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
} => {
  let startIndex = 0;
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded.kind !== options.kind || decoded.scope !== options.scope) {
      throw new Error('Cursor does not match the requested listing. Run the command again.');
    }
    startIndex = decoded.index;
  }

  const endIndex = Math.min(startIndex + options.limit, rows.length);
  const items = rows.slice(startIndex, endIndex);
  const hasMore = endIndex < rows.length;
  const nextCursor = hasMore
    ? encodeCursor({
        v: 1,
        kind: options.kind,
        scope: options.scope,
        index: endIndex,
      })
    : undefined;

  return {
    items,
    page: {
      limit: options.limit,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
    },
  };
};
