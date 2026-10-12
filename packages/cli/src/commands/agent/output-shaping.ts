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
import { paginateArray, type PageResult } from '@rozenite/agent-shared';

/**
 * Pages a listing the CLI builds itself with the shared pager
 * (`paginateArray`, ADR 0004): a cursor resumes after the row it names, so
 * a row that appears or disappears between two pages cannot shift the next
 * one, and when the named row is gone the page is empty with `reset: true`.
 * `scope` keeps a cursor from one listing off another.
 */
export const paginateListing = <T>(
  rows: readonly T[],
  options: {
    keyOf: (row: T) => string;
    scope: string;
    limit: number;
    cursor?: string;
  },
): PageResult<T> =>
  paginateArray(rows, {
    keyOf: options.keyOf,
    scope: options.scope,
    limit: options.limit,
    cursor: options.cursor,
  });

const shellEscape = (value: string): string => {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\"'\"'")}'`;
};

/** Builds a copy-pasteable POSIX shell command from already-separated args. */
export const formatAgentCommand = (args: readonly string[]): string =>
  ['npx', 'rozenite', 'agent', ...args].map(shellEscape).join(' ');
