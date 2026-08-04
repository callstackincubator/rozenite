import {
  type InfiniteData,
  type QueryClient,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { RozeniteDevToolsRequestClient } from '@rozenite/plugin-bridge';
import { useCallback, useEffect, useMemo } from 'react';
import type {
  StorageEventMap,
  StorageListEntryPreviewsResponseEvent,
} from '../shared/messaging';
import type { StorageEntryPreview, StorageTarget } from '../shared/types';

export const STORAGE_ENTRY_PREVIEW_PAGE_SIZE = 100;
export const STORAGE_ENTRY_PREVIEW_MAX_PAGES = 5;

type StorageRequestClient = Pick<
  RozeniteDevToolsRequestClient<StorageEventMap>,
  'request'
>;

export const normalizeStorageKeySearch = (search: string) =>
  search.trim().toLowerCase();

export const storageEntryPreviewQueryKeyPrefix = (target: StorageTarget) =>
  ['storage-entry-previews', target.adapterId, target.storageId] as const;

export const storageEntryPreviewQueryKey = (
  target: StorageTarget,
  search: string,
  keySortDirection: 'ascending' | 'descending',
) =>
  [
    ...storageEntryPreviewQueryKeyPrefix(target),
    normalizeStorageKeySearch(search),
    keySortDirection,
  ] as const;

const storageFullEntryQueryKeyPrefix = (target: StorageTarget) =>
  ['storage-full-entry', target.adapterId, target.storageId] as const;

const storageFullEntryQueryKey = (target: StorageTarget, key: string) =>
  [...storageFullEntryQueryKeyPrefix(target), key] as const;

export const resetSelectedStorageQueries = async (
  queryClient: QueryClient,
  target: StorageTarget,
) => {
  const previewQueryKey = storageEntryPreviewQueryKeyPrefix(target);
  const fullEntryQueryKey = storageFullEntryQueryKeyPrefix(target);

  await queryClient.cancelQueries({ queryKey: previewQueryKey });
  await queryClient.cancelQueries({ queryKey: fullEntryQueryKey });
  queryClient.removeQueries({ queryKey: fullEntryQueryKey });
  await queryClient.resetQueries({ queryKey: previewQueryKey });
};

export const invalidateStorageEntryPreviews = async (
  queryClient: QueryClient,
  target: StorageTarget,
) =>
  queryClient.invalidateQueries({
    queryKey: storageEntryPreviewQueryKeyPrefix(target),
  });

export const dropStorageFullEntries = async (
  queryClient: QueryClient,
  target: StorageTarget,
  key?: string,
) => {
  const queryKey = key == null
    ? storageFullEntryQueryKeyPrefix(target)
    : storageFullEntryQueryKey(target, key);

  await queryClient.cancelQueries({ queryKey, exact: key != null });
  queryClient.removeQueries({ queryKey, exact: key != null });
};

export type UseStorageEntryPreviewsOptions = {
  client: StorageRequestClient | null | undefined;
  target: StorageTarget | null | undefined;
  search: string;
  keySortDirection: 'ascending' | 'descending';
  pageSize?: number;
  maxPages?: number;
};

export const useStorageEntryPreviews = ({
  client,
  target,
  search,
  keySortDirection,
  pageSize = STORAGE_ENTRY_PREVIEW_PAGE_SIZE,
  maxPages = STORAGE_ENTRY_PREVIEW_MAX_PAGES,
}: UseStorageEntryPreviewsOptions) => {
  const normalizedSearch = normalizeStorageKeySearch(search);
  const queryKey = useMemo(
    () =>
      target
        ? storageEntryPreviewQueryKey(
            target,
            normalizedSearch,
            keySortDirection,
          )
        : (['storage-entry-previews', 'no-target'] as const),
    [keySortDirection, normalizedSearch, target?.adapterId, target?.storageId],
  );

  return useInfiniteQuery({
    queryKey,
    enabled: client != null && target != null,
    initialPageParam: undefined as string | undefined,
    maxPages: Math.max(1, maxPages),
    queryFn: ({ pageParam, signal }) => {
      if (!client || !target) {
        throw new Error('A storage target and request client are required.');
      }

      return client.request({
        requestType: 'list-entry-previews',
        responseType: 'entry-previews',
        errorType: 'storage-request-error',
        payload: {
          type: 'list-entry-previews',
          target,
          search: normalizedSearch || undefined,
          keySortDirection,
          cursor: pageParam,
          limit: pageSize,
        },
        signal,
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    getPreviousPageParam: (firstPage) => firstPage.previousCursor,
    refetchOnWindowFocus: false,
  });
};

export const flattenStorageEntryPreviewPages = (
  data: InfiniteData<StorageListEntryPreviewsResponseEvent> | undefined,
): StorageEntryPreview[] => data?.pages.flatMap((page) => page.items) ?? [];

export type UseStorageFullEntryOptions = {
  client: StorageRequestClient | null | undefined;
  target: StorageTarget | null | undefined;
  key: string | null | undefined;
  enabled?: boolean;
};

export const useStorageFullEntry = ({
  client,
  target,
  key,
  enabled = true,
}: UseStorageFullEntryOptions) => {
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () =>
      target && key != null
        ? storageFullEntryQueryKey(target, key)
        : (['storage-full-entry', 'no-entry'] as const),
    [key, target?.adapterId, target?.storageId],
  );

  const result = useQuery({
    queryKey,
    enabled: enabled && client != null && target != null && key != null,
    gcTime: 0,
    queryFn: ({ signal }) => {
      if (!client || !target || key == null) {
        throw new Error(
          'A storage target, key, and request client are required.',
        );
      }

      return client.request({
        requestType: 'get-entry',
        responseType: 'entry',
        errorType: 'storage-request-error',
        payload: { type: 'get-entry', target, key },
        signal,
      });
    },
    refetchOnWindowFocus: false,
  });

  useEffect(
    () => () => {
      void queryClient.cancelQueries({ queryKey });
      queryClient.removeQueries({ queryKey });
    },
    [queryClient, queryKey],
  );

  const reset = useCallback(() => {
    void queryClient.cancelQueries({ queryKey });
    queryClient.removeQueries({ queryKey });
  }, [queryClient, queryKey]);

  return { ...result, entry: result.data?.entry, reset };
};
