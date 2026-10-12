import { hashFilters } from '../pagination/filters-hash.js';

/**
 * The scope a React list cursor is bound to.
 *
 * React's lists are not logs: they are derived on every call from a tree that
 * remounts, or from a profiling session that is replaced wholesale on the next
 * `startProfiling`. "After node 12 in the children of node 3" means nothing
 * against "the results of searching Button", so a cursor names the tool, the
 * device and the filters it was issued under, and `paginateArray` refuses it
 * under anything else. Hashed together and shortened, because the scope rides
 * inside every cursor and every `next` command.
 */
export const reactListScope = (tool: string, deviceId: string, filters: unknown): string => {
  return hashFilters({ tool, deviceId, filters }).slice(0, 16);
};
