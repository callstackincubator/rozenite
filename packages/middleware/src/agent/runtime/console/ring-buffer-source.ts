import type {
  ListFromResult,
  PaginatedSource,
  SourceBounds,
} from '../pagination/types.js';

export interface RingBufferItem {
  seq: number;
}

const toArray = <T>(items: readonly T[]): T[] => {
  return Array.prototype.slice.call(items) as T[];
};

export const createRingBufferSource = <
  TItem extends RingBufferItem,
  TFilters,
>(input: {
  items: readonly TItem[];
  applyFilters: (items: readonly TItem[], filters: TFilters) => TItem[];
}): PaginatedSource<number, TItem, TFilters> => {
  const getFiltered = (filters: TFilters): TItem[] => {
    return input
      .applyFilters(input.items, filters)
      .sort((a, b) => a.seq - b.seq);
  };

  const getBounds = (filters: TFilters): SourceBounds<number> => {
    const filtered = getFiltered(filters);
    if (filtered.length === 0) {
      return {};
    }

    return {
      earliest: filtered[0].seq,
      latest: filtered[filtered.length - 1].seq,
    };
  };

  const listFrom = (args: {
    checkpoint?: number;
    order: 'asc' | 'desc';
    limit: number;
    filters: TFilters;
  }): ListFromResult<number, TItem> => {
    const filtered = getFiltered(args.filters);
    if (filtered.length === 0) {
      return {
        items: [],
        hasMore: false,
      };
    }

    const earliest = filtered[0].seq;
    const latest = filtered[filtered.length - 1].seq;

    let staleCursor = false;
    if (
      args.checkpoint !== undefined &&
      Number.isFinite(args.checkpoint) &&
      args.checkpoint < earliest - 1
    ) {
      staleCursor = true;
    }

    let working = toArray(filtered);
    if (args.order === 'desc') {
      working = working.reverse();
    }

    if (!staleCursor && args.checkpoint !== undefined) {
      if (args.order === 'desc') {
        working = working.filter((item) => item.seq <= args.checkpoint!);
      } else {
        working = working.filter((item) => item.seq > args.checkpoint!);
      }
    }

    const items = working.slice(0, args.limit);
    const hasMore = working.length > items.length;

    if (items.length === 0) {
      return {
        items: [],
        hasMore: false,
        staleCursor,
      };
    }

    const lastItem = items[items.length - 1];
    const nextCheckpoint =
      args.order === 'desc'
        ? Math.max(lastItem.seq - 1, earliest - 1)
        : Math.min(lastItem.seq, latest);

    return {
      items,
      hasMore,
      ...(hasMore ? { nextCheckpoint } : {}),
      ...(staleCursor ? { staleCursor: true } : {}),
    };
  };

  return {
    listFrom,
    getBounds,
  };
};
