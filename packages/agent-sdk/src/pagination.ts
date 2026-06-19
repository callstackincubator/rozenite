import type { AgentCallToolAutoPaginationOptions } from './types.js';

type ToolCaller = {
  callTool: (name: string, args: unknown) => Promise<unknown>;
};

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

const isPositiveInteger = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
};

const validateAutoPagination = (
  options: AgentCallToolAutoPaginationOptions,
): void => {
  if (
    options.pagesLimit !== undefined &&
    !isPositiveInteger(options.pagesLimit)
  ) {
    throw new Error('autoPaginate.pagesLimit must be a positive integer');
  }

  if (options.maxItems !== undefined && !isPositiveInteger(options.maxItems)) {
    throw new Error('autoPaginate.maxItems must be a positive integer');
  }

  if (options.maxItems !== undefined && options.pagesLimit === undefined) {
    throw new Error('autoPaginate.maxItems requires autoPaginate.pagesLimit');
  }
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

const normalizeArgs = (args: unknown): Record<string, unknown> => {
  if (!isRecord(args)) {
    return {};
  }

  return { ...args };
};

const getTrimmedItems = (
  items: unknown[],
  maxItems: number | undefined,
): unknown[] => {
  return maxItems === undefined ? [...items] : items.slice(0, maxItems);
};

export const callToolWithOptionalPagination = async (
  client: ToolCaller,
  toolName: string,
  args: unknown,
  config: AgentCallToolAutoPaginationOptions,
): Promise<unknown> => {
  validateAutoPagination(config);

  const initial = await client.callTool(toolName, args);
  const shouldAutoPaginate =
    config.pagesLimit !== undefined || config.maxItems !== undefined;
  if (!shouldAutoPaginate || !isPagedResponse(initial)) {
    return initial;
  }

  const pagesLimit = config.pagesLimit ?? 1;
  const maxItems = config.maxItems;

  let pageCount = 1;
  let cursor = initial.page.nextCursor;
  const merged: PagedResponse = {
    ...initial,
    items: getTrimmedItems(initial.items, maxItems),
    page: { ...initial.page },
  };

  while (
    cursor &&
    merged.page.hasMore &&
    pageCount < pagesLimit &&
    (maxItems === undefined || merged.items.length < maxItems)
  ) {
    const nextArgs = {
      ...normalizeArgs(args),
      cursor,
    };

    const next = await client.callTool(toolName, nextArgs);
    if (!isPagedResponse(next)) {
      break;
    }

    if (next.page.reset) {
      merged.items = getTrimmedItems(next.items, maxItems);
      merged.page = { ...next.page };
      cursor = next.page.nextCursor;
      pageCount += 1;

      if (maxItems !== undefined && merged.items.length >= maxItems) {
        break;
      }

      continue;
    }

    const remaining =
      maxItems === undefined
        ? next.items.length
        : Math.max(0, maxItems - merged.items.length);

    merged.items.push(...next.items.slice(0, remaining));
    merged.page = { ...next.page };
    cursor = next.page.nextCursor;
    pageCount += 1;

    if (maxItems !== undefined && merged.items.length >= maxItems) {
      break;
    }
  }

  merged.page.limit = initial.page.limit;
  return merged;
};
