/**
 * CLI-only Agent output shaping.
 *
 * The transport-agnostic shaping primitives (`parseFields`, `parseLimit`,
 * `projectRows`, `shapePaginatedRows`, `shapeToolResult`, and friends) live
 * in `@rozenite/agent-shared` — they're shared with MCP and any other
 * `@rozenite/agent-sdk` consumer. What stays here is CLI-specific:
 *
 * - `paginateRows` is an offset pager scoped to CLI-owned listings
 *   (`tools`/`domains`), not the general shared pagination engine (that's
 *   a separate effort — see #320).
 * - `formatAgentCommand`/`shellEscape` build the `npx rozenite agent ...`
 *   next-page affordance, which is meaningless outside a shell (in MCP the
 *   next-page affordance is a `page` argument to the call-tool, not a
 *   command to run).
 */

type CursorPayload = {
  v: 1;
  kind: 'tools' | 'domains';
  scope: string;
  index: number;
};

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

type PaginatedRows<T> = {
  items: T[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
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
