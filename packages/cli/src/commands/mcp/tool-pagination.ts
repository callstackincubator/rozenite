import type { HttpMCPClient } from './http-client.js';

type PagedResponse = {
  items: unknown[];
  page: {
    limit: number;
    hasMore: boolean;
    nextCursor?: string;
    reset?: boolean;
  };
  [key: string]: unknown;
};

export type ToolAutoPaginationOptions = {
  pages?: string;
  maxItems?: string;
};

const parsePositiveIntOption = (raw: string | undefined, optionName: string): number | undefined => {
  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${optionName} must be a positive integer`);
  }

  return parsed;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const isPagedResponse = (value: unknown): value is PagedResponse => {
  if (!isRecord(value)) {
    return false;
  }

  if (!Array.isArray(value.items)) {
    return false;
  }

  const page = value.page;
  if (!isRecord(page)) {
    return false;
  }

  return typeof page.hasMore === 'boolean' && typeof page.limit === 'number';
};

export const resolveAutoPaginationConfig = (options: ToolAutoPaginationOptions): {
  pagesLimit?: number;
  maxItems?: number;
} => {
  const pagesLimit = parsePositiveIntOption(options.pages, '--pages');
  const maxItems = parsePositiveIntOption(options.maxItems, '--max-items');
  if (maxItems !== undefined && pagesLimit === undefined) {
    throw new Error('--max-items requires --pages');
  }

  return {
    ...(pagesLimit ? { pagesLimit } : {}),
    ...(maxItems ? { maxItems } : {}),
  };
};

const normalizeArgs = (args: unknown): Record<string, unknown> => {
  if (!isRecord(args)) {
    return {};
  }

  return { ...args };
};

export const callToolWithOptionalPagination = async (
  client: HttpMCPClient,
  toolName: string,
  args: unknown,
  config: { pagesLimit?: number; maxItems?: number },
): Promise<unknown> => {
  const initial = await client.callTool(toolName, args);

  const shouldAutoPaginate = config.pagesLimit !== undefined || config.maxItems !== undefined;
  if (!shouldAutoPaginate || !isPagedResponse(initial)) {
    return initial;
  }

  const pagesLimit = config.pagesLimit ?? 1;
  const maxItems = config.maxItems;

  let pageCount = 1;
  let cursor = initial.page.nextCursor;
  const merged: PagedResponse = {
    ...initial,
    items: [...initial.items],
    page: { ...initial.page },
  };

  while (
    cursor
    && merged.page.hasMore
    && pageCount < pagesLimit
    && (maxItems === undefined || merged.items.length < maxItems)
  ) {
    const nextArgs = {
      ...normalizeArgs(args),
      cursor,
    };

    const next = await client.callTool(toolName, nextArgs);
    if (!isPagedResponse(next)) {
      break;
    }

    const remaining = maxItems === undefined
      ? next.items.length
      : Math.max(0, maxItems - merged.items.length);
    merged.items.push(...next.items.slice(0, remaining));
    merged.page = { ...next.page };
    cursor = next.page.nextCursor;
    pageCount += 1;

    if (maxItems !== undefined && merged.items.length >= maxItems) {
      merged.page.hasMore = true;
      break;
    }
  }

  merged.page.limit = initial.page.limit;
  return merged;
};
