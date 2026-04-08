import {
  decodeCursor,
  encodeCursor,
  hashFilters,
  validateCursorContext,
} from './cursor.js';
import { normalizePageLimit } from './limits.js';
import type {
  CursorPayload,
  PageOrder,
  PageResult,
  PaginatedSource,
} from './types.js';

export const paginateSource = <
  TCheckpoint extends string | number,
  TItem,
  TFilters,
>(
  source: PaginatedSource<TCheckpoint, TItem, TFilters>,
  input: {
    tool: string;
    deviceId: string;
    request: {
      limit?: unknown;
      cursor?: unknown;
      order?: unknown;
      filters: TFilters;
    };
  },
): PageResult<TItem> => {
  const limit = normalizePageLimit(input.request.limit);
  const order: PageOrder = input.request.order === 'asc' ? 'asc' : 'desc';
  const filtersHash = hashFilters(input.request.filters);

  let checkpoint: TCheckpoint | undefined;
  if (
    typeof input.request.cursor === 'string' &&
    input.request.cursor.trim().length > 0
  ) {
    const payload = decodeCursor<TCheckpoint>(input.request.cursor);
    validateCursorContext(payload as CursorPayload<unknown>, {
      tool: input.tool,
      deviceId: input.deviceId,
      filtersHash,
      order,
    });
    checkpoint = payload.position;
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
      ? encodeCursor<TCheckpoint>({
          v: 1,
          tool: input.tool,
          deviceId: input.deviceId,
          position: result.nextCheckpoint,
          filtersHash,
          order,
        })
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
