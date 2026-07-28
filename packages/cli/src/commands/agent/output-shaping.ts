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
    throw new Error(
      'Invalid --cursor. Run the listing command again with --limit 20.',
    );
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
    throw new Error(
      `--limit must be an integer between 1 and ${MAX_PAGE_LIMIT}`,
    );
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

type PaginatedRows<T> = {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Shapes CLI-owned row listings for agent consumption.
 *
 * The selected fields, rather than fields observed in individual rows, define
 * `cols`. This keeps the wire shape stable when optional values are absent.
 * Zero- and one-row listings remain expanded because a column header costs
 * more than the repeated keys it removes.
 */
export const shapePaginatedRows = (
  paged: PaginatedRows<Record<string, unknown>>,
  fields: readonly string[],
  nextCommand: string | undefined,
): Record<string, unknown> => {
  const next = paged.page.hasMore && nextCommand ? { next: nextCommand } : {};

  if (paged.items.length < 2) {
    return {
      items: paged.items,
      ...next,
    };
  }

  return {
    cols: [...fields],
    rows: paged.items.map((row) => fields.map((field) => row[field] ?? null)),
    ...next,
  };
};

/**
 * Applies the CLI presentation contract to a known tool's paginated result
 * while retaining any non-row metadata owned by that tool.
 */
export const shapeToolResult = (
  result: unknown,
  fields: readonly string[],
  nextCommand: string | undefined,
): unknown => {
  if (
    !isRecord(result) ||
    !Array.isArray(result.items) ||
    !isRecord(result.page)
  ) {
    return result;
  }

  const { items, page, ...metadata } = result;
  if (typeof page.limit !== 'number' || typeof page.hasMore !== 'boolean') {
    return result;
  }
  if (page.hasMore && !nextCommand) {
    return result;
  }

  return {
    ...metadata,
    ...shapePaginatedRows(
      {
        items: items as Record<string, unknown>[],
        page: {
          limit: page.limit,
          hasMore: page.hasMore,
          ...(typeof page.nextCursor === 'string'
            ? { nextCursor: page.nextCursor }
            : {}),
        },
      },
      fields,
      nextCommand,
    ),
  };
};

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`;
};

/** Builds a copy-pasteable POSIX shell command from already-separated args. */
export const formatAgentCommand = (args: readonly string[]): string =>
  ['rozenite', 'agent', ...args].map(shellEscape).join(' ');

export const paginateRows = <T>(
  rows: T[],
  options: {
    kind: 'tools' | 'domains';
    scope: string;
    limit: number;
    cursor?: string;
  },
): PaginatedRows<T> => {
  let startIndex = 0;
  if (options.cursor) {
    const decoded = decodeCursor(options.cursor);
    if (decoded.kind !== options.kind || decoded.scope !== options.scope) {
      throw new Error(
        'Cursor does not match the requested listing. Run the command again.',
      );
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
