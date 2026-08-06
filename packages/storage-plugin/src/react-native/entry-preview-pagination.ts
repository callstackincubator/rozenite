import { toStorageEntryPreview } from '../shared/entry-preview';
import type {
  StorageListEntryPreviewsRequestEvent,
  StorageListEntryPreviewsResponseEvent,
  StorageRequestErrorEvent,
} from '../shared/messaging';
import type { StorageEntryPreview, StorageTarget } from '../shared/types';
import type { StorageView } from './storage-view';

export const MAX_ENTRY_PREVIEW_PAGE_SIZE = 100;
export const ENTRY_PREVIEW_READ_CONCURRENCY = 4;

type PaginationResult = StorageListEntryPreviewsResponseEvent | StorageRequestErrorEvent;

type Cursor = {
  version: 1;
  target: StorageTarget;
  search: string;
  keySortDirection: 'ascending' | 'descending';
  boundaryKey: string;
  direction: 'next' | 'previous';
};

type ValidRequest = Omit<
  StorageListEntryPreviewsRequestEvent,
  'search' | 'keySortDirection' | 'limit'
> & {
  search: string;
  keySortDirection: 'ascending' | 'descending';
  limit: number;
};

const getRequestId = (payload: unknown) =>
  typeof payload === 'object' &&
  payload != null &&
  !Array.isArray(payload) &&
  typeof (payload as { requestId?: unknown }).requestId === 'string'
    ? (payload as { requestId: string }).requestId
    : '';

const isTarget = (value: unknown): value is StorageTarget =>
  typeof value === 'object' &&
  value != null &&
  !Array.isArray(value) &&
  typeof (value as { adapterId?: unknown }).adapterId === 'string' &&
  (value as { adapterId: string }).adapterId.trim().length > 0 &&
  typeof (value as { storageId?: unknown }).storageId === 'string' &&
  (value as { storageId: string }).storageId.trim().length > 0;

const normalizeSearch = (search: string | undefined) => (search ?? '').trim().toLowerCase();

const validateRequest = (payload: unknown): ValidRequest | undefined => {
  if (
    typeof payload !== 'object' ||
    payload == null ||
    Array.isArray(payload) ||
    (payload as { type?: unknown }).type !== 'list-entry-previews' ||
    typeof (payload as { requestId?: unknown }).requestId !== 'string' ||
    (payload as { requestId: string }).requestId.trim().length === 0 ||
    !isTarget((payload as { target?: unknown }).target) ||
    ((payload as { search?: unknown }).search !== undefined &&
      typeof (payload as { search?: unknown }).search !== 'string') ||
    ((payload as { cursor?: unknown }).cursor !== undefined &&
      typeof (payload as { cursor?: unknown }).cursor !== 'string') ||
    !Number.isFinite((payload as { limit?: unknown }).limit) ||
    !Number.isInteger((payload as { limit: number }).limit) ||
    (payload as { limit: number }).limit < 1
  ) {
    return undefined;
  }

  const keySortDirection = (payload as { keySortDirection?: unknown }).keySortDirection;
  if (
    keySortDirection !== undefined &&
    keySortDirection !== 'ascending' &&
    keySortDirection !== 'descending'
  ) {
    return undefined;
  }

  const request = payload as StorageListEntryPreviewsRequestEvent;
  return {
    ...request,
    search: normalizeSearch(request.search),
    keySortDirection: keySortDirection ?? 'ascending',
    limit: Math.min(request.limit, MAX_ENTRY_PREVIEW_PAGE_SIZE),
  };
};

// Cursor contents are intentionally private to the device protocol. Callers only
// receive and return this opaque token; its representation may change freely.
const encodeCursor = (cursor: Cursor) => btoa(encodeURIComponent(JSON.stringify(cursor)));

const decodeCursor = (value: string): Cursor | undefined => {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(atob(value)));
    if (
      typeof parsed !== 'object' ||
      parsed == null ||
      Array.isArray(parsed) ||
      (parsed as { version?: unknown }).version !== 1 ||
      !isTarget((parsed as { target?: unknown }).target) ||
      typeof (parsed as { search?: unknown }).search !== 'string' ||
      ((parsed as { keySortDirection?: unknown }).keySortDirection !== 'ascending' &&
        (parsed as { keySortDirection?: unknown }).keySortDirection !== 'descending') ||
      typeof (parsed as { boundaryKey?: unknown }).boundaryKey !== 'string' ||
      ((parsed as { direction?: unknown }).direction !== 'next' &&
        (parsed as { direction?: unknown }).direction !== 'previous')
    ) {
      return undefined;
    }

    return parsed as Cursor;
  } catch {
    return undefined;
  }
};

const isSameTarget = (left: StorageTarget, right: StorageTarget) =>
  left.adapterId === right.adapterId && left.storageId === right.storageId;

const compareKeys = (left: string, right: string) => (left < right ? -1 : left > right ? 1 : 0);

const readPreviews = async (
  view: StorageView,
  keys: readonly string[],
): Promise<StorageEntryPreview[]> => {
  const previews: StorageEntryPreview[] = new Array(keys.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < keys.length) {
      const index = nextIndex;
      nextIndex += 1;
      const entry = await view.get(keys[index]);
      if (entry) {
        previews[index] = toStorageEntryPreview(entry);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(ENTRY_PREVIEW_READ_CONCURRENCY, keys.length) }, worker),
  );
  return previews.filter((preview): preview is StorageEntryPreview => preview != null);
};

export const handleListEntryPreviewsRequest = async (
  views: readonly StorageView[],
  payload: unknown,
): Promise<PaginationResult> => {
  const requestId = getRequestId(payload);
  const request = validateRequest(payload);
  if (!request) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'INVALID_REQUEST',
      message:
        'Entry preview requests require a valid target, request ID, and positive integer limit.',
    };
  }

  const view = views.find((candidate) => isSameTarget(candidate.target, request.target));
  if (!view) {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'TARGET_NOT_FOUND',
      message: 'The requested storage target was not found.',
    };
  }

  let cursor: Cursor | undefined;
  if (request.cursor !== undefined) {
    cursor = decodeCursor(request.cursor);
    if (
      !cursor ||
      !isSameTarget(cursor.target, request.target) ||
      cursor.search !== request.search ||
      cursor.keySortDirection !== request.keySortDirection
    ) {
      return {
        type: 'storage-request-error',
        requestId,
        code: 'INVALID_CURSOR',
        message: 'The entry preview cursor is invalid or belongs to a different query.',
        resetPagination: true,
      };
    }
  }

  try {
    const keys = (await view.getAllKeys())
      .filter((key) => key.toLowerCase().includes(request.search))
      .sort(compareKeys);
    if (request.keySortDirection === 'descending') {
      keys.reverse();
    }

    let start = 0;
    if (cursor) {
      const boundaryIndex = keys.indexOf(cursor.boundaryKey);
      if (boundaryIndex === -1) {
        return {
          type: 'storage-request-error',
          requestId,
          code: 'INVALID_CURSOR',
          message: 'The entry preview cursor is stale after storage changes.',
          resetPagination: true,
        };
      }
      start =
        cursor.direction === 'next'
          ? boundaryIndex + 1
          : Math.max(0, boundaryIndex - request.limit);
    }

    const pageKeys = keys.slice(start, start + request.limit);
    const items = await readPreviews(view, pageKeys);
    const end = start + pageKeys.length;
    const cursorBase = {
      version: 1 as const,
      target: request.target,
      search: request.search,
      keySortDirection: request.keySortDirection,
    };

    return {
      type: 'entry-previews',
      requestId,
      target: request.target,
      items,
      ...(end < keys.length && pageKeys.length > 0
        ? {
            nextCursor: encodeCursor({
              ...cursorBase,
              boundaryKey: pageKeys.at(-1)!,
              direction: 'next',
            }),
          }
        : {}),
      ...(start > 0 && pageKeys.length > 0
        ? {
            previousCursor: encodeCursor({
              ...cursorBase,
              boundaryKey: pageKeys[0],
              direction: 'previous',
            }),
          }
        : {}),
    };
  } catch {
    return {
      type: 'storage-request-error',
      requestId,
      code: 'READ_FAILED',
      message: 'Failed to read entry previews from the requested storage.',
    };
  }
};
