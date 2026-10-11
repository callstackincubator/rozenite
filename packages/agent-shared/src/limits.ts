/**
 * Page-size rules shared by every Agent list (ADR 0004, decision 1): the
 * CLI's `--limit` and a tool's `limit` argument are normalised by the same
 * code, so they cannot drift apart.
 *
 * This module imports nothing, so both `output-shaping.ts` and
 * `pagination.ts` can depend on it without forming an import cycle.
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

/**
 * Normalises a raw page size: absent (`undefined`, `null`, `''`) means
 * {@link DEFAULT_PAGE_LIMIT}, values above {@link MAX_PAGE_LIMIT} are
 * capped, and anything that is not a positive integer throws an error that
 * names the argument as `label` (for example `"limit"` or `--limit`).
 */
export const normalizeLimit = (value: unknown, label: string): number => {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PAGE_LIMIT;
  }

  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be an integer between 1 and ${MAX_PAGE_LIMIT}`);
  }

  return Math.min(parsed, MAX_PAGE_LIMIT);
};
