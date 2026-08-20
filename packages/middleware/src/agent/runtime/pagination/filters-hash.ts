import { createHash } from 'node:crypto';

type ComparableValue =
  | null
  | boolean
  | number
  | string
  | ComparableValue[]
  | { [key: string]: ComparableValue };

const normalizeForHash = (value: unknown): ComparableValue => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string'
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

/**
 * Stable hash of a filter set, for cursors whose position is only meaningful
 * within the query that produced it. The shared cursor format no longer binds
 * filters — see the note in `cursor.ts` — but the React domain keeps its own
 * cursors and its own rules, so the helper lives on here.
 */
export const hashFilters = (filters: unknown): string => {
  const normalized = normalizeForHash(filters ?? {});
  const raw = JSON.stringify(normalized);
  return createHash('sha1').update(raw).digest('hex');
};
