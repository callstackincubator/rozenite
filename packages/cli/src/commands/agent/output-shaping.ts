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

/**
 * Projects rows onto the selected fields for columnar encoding, where each
 * row becomes a fixed-width array positionally aligned with `cols`. Absent
 * values become an explicit `null` placeholder because a missing array slot
 * would shift every column after it.
 */
export const projectRows = <T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
): Record<string, unknown>[] => {
  return rows.map((row) => {
    const projected: Record<string, unknown> = {};
    for (const field of fields) {
      projected[field] = row[field] ?? null;
    }
    return projected;
  });
};

/**
 * Projects rows onto the selected fields for row-keyed encoding, where each
 * row stays an object. Unlike {@link projectRows}, absent fields are omitted
 * rather than nulled: row-keyed output exists specifically for the 0/1-row
 * case (see {@link shapePaginatedRows}), where explicit nulls would make the
 * payload larger than the pre-columnar shape and defeat the point of
 * staying expanded.
 */
const projectRowKeyed = <T extends Record<string, unknown>>(
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
 *
 * The two branches project rows differently on purpose, via separate
 * helpers rather than a shared one with a flag: the row-keyed (`items`)
 * branch uses {@link projectRowKeyed}, which omits absent fields, so it
 * never grows past the pre-columnar row-keyed shape — the entire reason
 * 0/1-row listings stay expanded instead of going columnar. The columnar
 * (`cols`/`rows`) branch uses {@link projectRows}, which fills absent
 * fields with `null`, because positional array cells must line up with
 * `cols` and can't simply be omitted.
 */
export const shapePaginatedRows = (
  paged: PaginatedRows<Record<string, unknown>>,
  fields: readonly string[],
  nextCommand: string | undefined,
): Record<string, unknown> => {
  const next = paged.page.hasMore && nextCommand ? { next: nextCommand } : {};

  if (paged.items.length < 2) {
    return {
      items: projectRowKeyed(paged.items, fields),
      ...next,
    };
  }

  const items = projectRows(paged.items, fields);
  return {
    cols: [...fields],
    rows: items.map((row) => fields.map((field) => row[field])),
    ...next,
  };
};

/** Top-level keys `shapeToolResult` itself introduces into its output. */
const SHAPED_OUTPUT_KEYS = ['cols', 'rows', 'next'] as const;

/**
 * Applies the CLI presentation contract to a known tool's paginated result
 * while retaining any non-row metadata owned by that tool.
 *
 * `metadata` (every top-level key besides `items`/`page`) is spread ahead of
 * the shaped output, so a tool whose own metadata uses one of the keys this
 * function produces (`cols`, `rows`, `next`) would otherwise have it
 * silently overwritten. Rather than let that happen invisibly, such a
 * collision degrades the whole result to unshaped — the same "degrade
 * rather than corrupt" rule this function already applies to malformed
 * pagination envelopes.
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
  if (
    !items.every(isRecord) ||
    typeof page.limit !== 'number' ||
    !Number.isFinite(page.limit) ||
    !Number.isInteger(page.limit) ||
    page.limit < 1 ||
    typeof page.hasMore !== 'boolean' ||
    (page.nextCursor !== undefined && typeof page.nextCursor !== 'string') ||
    (page.reset !== undefined && typeof page.reset !== 'boolean')
  ) {
    return result;
  }
  if (page.hasMore && !nextCommand) {
    return result;
  }
  if (SHAPED_OUTPUT_KEYS.some((key) => Object.hasOwn(metadata, key))) {
    return result;
  }

  return {
    ...metadata,
    ...(page.reset === true ? { page: { reset: true } } : {}),
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
  ['npx', 'rozenite', 'agent', ...args].map(shellEscape).join(' ');

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
