/**
 * CLI-only Agent output shaping.
 *
 * The transport-agnostic shaping primitives (`parseFields`, `parseLimit`,
 * `shapePaginatedRows`, `shapeToolResult`, and friends) live in
 * `@rozenite/agent-shared` — they're shared with MCP and any other
 * `@rozenite/agent-sdk` consumer. What stays here is CLI-specific:
 *
 * - `paginateListing` pages the listings the CLI builds itself (`domains`,
 *   a domain's tools, `targets`, `session list`).
 * - `formatAgentCommand`/`shellEscape` build the `npx rozenite agent ...`
 *   next-page affordance, which is meaningless outside a shell (in MCP the
 *   next-page affordance is a `page` argument to the call-tool, not a
 *   command to run).
 */
import type { PageResult } from '@rozenite/agent-shared';

type ListingCursor = {
  v: 2;
  /** Key of the last row returned. */
  k: string;
  /** What was listed, so a cursor from one listing is not used on another. */
  s: string;
};

const INVALID_CURSOR_MESSAGE = 'Invalid --cursor. Run the command again without --cursor.';

const encodeListingCursor = (payload: ListingCursor): string =>
  Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');

const decodeListingCursor = (raw: string): ListingCursor => {
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as ListingCursor;
    if (payload.v !== 2 || typeof payload.k !== 'string' || typeof payload.s !== 'string') {
      throw new Error('Invalid cursor payload');
    }
    return payload;
  } catch {
    throw new Error(INVALID_CURSOR_MESSAGE);
  }
};

/**
 * Pages a listing the CLI builds itself. A cursor resumes after the row it
 * names, the way ADR 0004 asks every pager to, so a row that appears or
 * disappears between two pages cannot shift the next one; when the named
 * row is gone the page is empty with `reset: true`.
 *
 * This is the one place the CLI pages. ADR 0004 moves the same algorithm
 * into `@rozenite/agent-shared` as `paginateArray`; once that export
 * exists, this function becomes a call to it.
 */
export const paginateListing = <T>(
  rows: readonly T[],
  options: {
    keyOf: (row: T) => string;
    scope: string;
    limit: number;
    cursor?: string;
  },
): PageResult<T> => {
  let start = 0;
  if (options.cursor) {
    const cursor = decodeListingCursor(options.cursor);
    if (cursor.s !== options.scope) {
      throw new Error(
        '--cursor belongs to a different listing. Run the command again without --cursor.',
      );
    }

    const anchor = rows.findIndex((row) => options.keyOf(row) === cursor.k);
    if (anchor === -1) {
      return { items: [], page: { limit: options.limit, hasMore: false, reset: true } };
    }
    start = anchor + 1;
  }

  const items = rows.slice(start, start + options.limit);
  const hasMore = start + items.length < rows.length && items.length > 0;

  return {
    items,
    page: {
      limit: options.limit,
      hasMore,
      ...(hasMore
        ? {
            nextCursor: encodeListingCursor({
              v: 2,
              k: options.keyOf(items[items.length - 1]!),
              s: options.scope,
            }),
          }
        : {}),
    },
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
