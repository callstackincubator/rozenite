export type PageOrder = 'asc' | 'desc';

export interface PageRequest {
  limit?: number;
  cursor?: string;
  order?: PageOrder;
}

export type { PageEnvelope, PageResult } from '@rozenite/agent-shared';

export interface ListFromResult<TCheckpoint, TItem> {
  items: TItem[];
  hasMore: boolean;
  nextCheckpoint?: TCheckpoint;
  staleCursor?: boolean;
}

export interface PaginatedSource<TCheckpoint, TItem, TFilters> {
  listFrom(input: {
    checkpoint?: TCheckpoint;
    order: PageOrder;
    limit: number;
    filters: TFilters;
  }): ListFromResult<TCheckpoint, TItem>;
}
