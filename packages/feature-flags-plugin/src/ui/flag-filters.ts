import type { FeatureFlag } from '../shared/types';

/**
 * Filters `flags` by a case-insensitive substring match on `key` and,
 * optionally, to overridden-only. Pure so it's testable without mounting the
 * table.
 */
export const filterFlags = (
  flags: FeatureFlag[],
  search: string,
  overriddenOnly: boolean,
): FeatureFlag[] => {
  const normalizedSearch = search.trim().toLowerCase();

  return flags.filter((flag) => {
    if (overriddenOnly && !flag.overridden) {
      return false;
    }

    if (normalizedSearch && !flag.key.toLowerCase().includes(normalizedSearch)) {
      return false;
    }

    return true;
  });
};
