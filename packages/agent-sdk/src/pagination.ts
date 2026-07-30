import type { PageEnvelope } from '@rozenite/agent-shared';
import type { AgentCallToolAutoPaginationOptions } from './types.js';

type ToolCaller = {
  callTool: (name: string, args: unknown) => Promise<unknown>;
};

type PagedResponse = {
  items: unknown[];
  page: PageEnvelope;
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

// `limit` is a universal convention across every paginated agent tool (see
// packages/middleware/src/agent/local-domains.ts and the plugin
// packages/*/src/shared/agent-tools.ts contracts), so it's safe for the SDK
// to read and rewrite it when driving auto-pagination.
const getCallerLimit = (args: Record<string, unknown>): number | undefined => {
  return isPositiveInteger(args.limit) ? args.limit : undefined;
};

// The request limit for a call that must not fetch more than `remaining`
// rows. Respects a caller-supplied `limit` as a ceiling when present;
// otherwise requests exactly what's still needed.
const getRequestLimit = (
  callerLimit: number | undefined,
  remaining: number,
): number => {
  return callerLimit === undefined ? remaining : Math.min(callerLimit, remaining);
};

/**
 * Guaranteed-correct fallback for producers that clamp or ignore the
 * requested `limit` (e.g. a tool that declares "Page size. Default 50, max
 * 200" and returns its own default regardless of what's asked). If a
 * response comes back with MORE rows than were requested, the rows beyond
 * `requestedLimit` must be trimmed - but the producer's own `nextCursor`
 * was computed assuming the caller received the whole page it sent, so it
 * cannot be trusted to resume after the point we're truncating at.
 *
 * We only need to intervene when trimming would otherwise silently discard
 * a resumable position: if the untouched response has no cursor to lose
 * (hasMore is false / nextCursor is absent), trimming to the remaining
 * budget is the same "reached maxItems, stop here" behavior this helper
 * already performs elsewhere, and is left alone.
 */
const applyRequestBudget = (
  response: PagedResponse,
  requestedLimit: number | undefined,
): PagedResponse => {
  if (
    requestedLimit === undefined ||
    response.items.length <= requestedLimit
  ) {
    return response;
  }

  const trimmedItems = response.items.slice(0, requestedLimit);
  const hadResumablePosition =
    response.page.hasMore || response.page.nextCursor !== undefined;

  if (!hadResumablePosition) {
    return { ...response, items: trimmedItems };
  }

  return {
    ...response,
    items: trimmedItems,
    page: {
      ...response.page,
      // We positively know unconsumed rows exist: the ones we just
      // trimmed off. `hasMore` must reflect that even though we can no
      // longer say where to resume.
      hasMore: true,
      nextCursor: undefined,
      truncated: true,
    },
  };
};

export const callToolWithOptionalPagination = async (
  client: ToolCaller,
  toolName: string,
  args: unknown,
  config: AgentCallToolAutoPaginationOptions,
): Promise<unknown> => {
  validateAutoPagination(config);

  const shouldAutoPaginate =
    config.pagesLimit !== undefined || config.maxItems !== undefined;
  const pagesLimit = config.pagesLimit ?? 1;
  const maxItems = config.maxItems;

  const baseArgs = normalizeArgs(args);
  const callerLimit = getCallerLimit(baseArgs);

  // Never over-fetch: request exactly the rows still needed so the page
  // boundary coincides with the maxItems boundary, and the producer's own
  // nextCursor stays correct by construction. This applies to the initial
  // call too - not just subsequent ones.
  const initialRequestLimit =
    shouldAutoPaginate && maxItems !== undefined
      ? getRequestLimit(callerLimit, maxItems)
      : undefined;
  const initialArgs =
    initialRequestLimit === undefined
      ? args
      : { ...baseArgs, limit: initialRequestLimit };

  const initial = await client.callTool(toolName, initialArgs);
  if (!shouldAutoPaginate || !isPagedResponse(initial)) {
    return initial;
  }

  const initialAdjusted = applyRequestBudget(initial, initialRequestLimit);

  let pageCount = 1;
  let cursor = initialAdjusted.page.nextCursor;
  const merged: PagedResponse = {
    ...initialAdjusted,
    items: getTrimmedItems(initialAdjusted.items, maxItems),
    page: { ...initialAdjusted.page },
  };

  while (
    cursor &&
    merged.page.hasMore &&
    pageCount < pagesLimit &&
    (maxItems === undefined || merged.items.length < maxItems)
  ) {
    const remainingBudget =
      maxItems === undefined
        ? undefined
        : Math.max(0, maxItems - merged.items.length);
    const requestLimit =
      remainingBudget === undefined
        ? undefined
        : getRequestLimit(callerLimit, remainingBudget);

    const nextArgs = {
      ...baseArgs,
      cursor,
      ...(requestLimit === undefined ? {} : { limit: requestLimit }),
    };

    const rawNext = await client.callTool(toolName, nextArgs);
    if (!isPagedResponse(rawNext)) {
      break;
    }

    if (rawNext.page.reset) {
      merged.items = getTrimmedItems(rawNext.items, maxItems);
      merged.page = { ...rawNext.page };
      cursor = rawNext.page.nextCursor;
      pageCount += 1;

      if (maxItems !== undefined && merged.items.length >= maxItems) {
        break;
      }

      continue;
    }

    const next = applyRequestBudget(rawNext, requestLimit);

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

  // The reported `limit` reflects the producer's page size for the very
  // first raw response, never our internally-reduced per-request limit.
  merged.page.limit = initial.page.limit;
  return merged;
};
