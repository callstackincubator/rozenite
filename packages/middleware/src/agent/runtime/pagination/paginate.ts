import { decodeCursor, encodeCursor } from './cursor.js';
import { normalizePageLimit } from './limits.js';
import type { PageOrder, PageResult, PaginatedSource } from './types.js';

export const paginateSource = <TItem, TFilters>(
  source: PaginatedSource<number, TItem, TFilters>,
  input: {
    request: {
      limit?: unknown;
      cursor?: unknown;
      order?: unknown;
      filters: TFilters;
      /**
       * Where to start when no cursor is supplied, so a range bounded by an
       * anchor seeks straight to it instead of scanning from the edge. Ignored
       * once the caller is paging, since the cursor then owns the position.
       */
      seedCheckpoint?: number;
    };
  },
): PageResult<TItem> => {
  const limit = normalizePageLimit(input.request.limit);
  const order: PageOrder = input.request.order === 'asc' ? 'asc' : 'desc';

  let checkpoint: number | undefined = input.request.seedCheckpoint;
  if (typeof input.request.cursor === 'string' && input.request.cursor.trim().length > 0) {
    checkpoint = decodeCursor(input.request.cursor);
  }

  let result = source.listFrom({
    checkpoint,
    order,
    limit,
    filters: input.request.filters,
  });

  let reset = false;
  if (result.staleCursor) {
    result = source.listFrom({
      checkpoint: undefined,
      order,
      limit,
      filters: input.request.filters,
    });
    reset = true;
  }

  const nextCursor =
    result.hasMore && result.nextCheckpoint !== undefined
      ? encodeCursor(result.nextCheckpoint)
      : undefined;

  return {
    items: result.items,
    page: {
      limit,
      hasMore: result.hasMore,
      ...(nextCursor ? { nextCursor } : {}),
      ...(reset ? { reset: true } : {}),
    },
  };
};
