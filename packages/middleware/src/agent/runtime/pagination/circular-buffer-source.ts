import type { CircularBuffer } from '../collections/circular-buffer.js';
import type { ListFromResult, PageOrder, PaginatedSource } from './types.js';

/**
 * Adapts a {@link CircularBuffer} to the paginated-source contract.
 *
 * Checkpoints are buffer indices, so resuming a cursor is an O(1) seek rather
 * than a scan. From there the page is produced by a single walk that applies
 * the filter predicate inline and stops as soon as it has enough rows, so only
 * the returned page is ever materialized.
 */
export const createCircularBufferSource = <TItem, TFilters>(input: {
  buffer: CircularBuffer<TItem>;
  createPredicate: (filters: TFilters) => (item: TItem) => boolean;
}): PaginatedSource<number, TItem, TFilters> => {
  const listFrom = (args: {
    checkpoint?: number;
    order: PageOrder;
    limit: number;
    filters: TFilters;
  }): ListFromResult<number, TItem> => {
    const { buffer } = input;
    if (buffer.size === 0) {
      return { items: [], hasMore: false };
    }

    const first = buffer.first;
    const last = buffer.next - 1;

    const hasCheckpoint = args.checkpoint !== undefined && Number.isFinite(args.checkpoint);
    // A checkpoint is always exclusive and always names a real position: resume
    // strictly past it, in the direction of travel. That is what lets one cursor
    // format serve both roles — the cursor a page hands back and the cursor an
    // item carries mean the same thing, so either can resume a listing or bound
    // a range. It stays meaningful one step outside the window; older than that
    // and the rows the caller had not yet seen were evicted.
    const staleCursor = hasCheckpoint && args.checkpoint! < first - 1;

    let start: number;
    if (!hasCheckpoint || staleCursor) {
      start = args.order === 'desc' ? last : first;
    } else {
      start = args.order === 'desc' ? args.checkpoint! - 1 : args.checkpoint! + 1;
    }

    const matches = input.createPredicate(args.filters);
    const items: TItem[] = [];
    let lastIndex = -1;
    let hasMore = false;

    for (const [index, item] of buffer.from(start, args.order)) {
      if (!matches(item)) {
        continue;
      }

      if (items.length === args.limit) {
        hasMore = true;
        break;
      }

      items.push(item);
      lastIndex = index;
    }

    if (items.length === 0) {
      return { items: [], hasMore: false, ...(staleCursor ? { staleCursor: true } : {}) };
    }

    // The last row handed out, in both directions — the next page resumes past it.
    const nextCheckpoint = lastIndex;

    return {
      items,
      hasMore,
      ...(hasMore ? { nextCheckpoint } : {}),
      ...(staleCursor ? { staleCursor: true } : {}),
    };
  };

  return { listFrom };
};
