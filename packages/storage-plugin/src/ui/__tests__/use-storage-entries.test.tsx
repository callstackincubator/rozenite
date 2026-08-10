// @vitest-environment jsdom

import { QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RozeniteDevToolsRequestClient } from '@rozenite/plugin-bridge';
import type { StorageEventMap } from '../../shared/messaging';
import type { StorageTarget } from '../../shared/types';
import { createStorageQueryClient } from '../query-client';
import {
  resetSelectedStorageQueries,
  dropStorageFullEntries,
  invalidateStorageEntryPreviews,
  storageEntryPreviewQueryKey,
  useStorageEntryPreviews,
  useStorageFullEntry,
} from '../use-storage-entries';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

const target: StorageTarget = { adapterId: 'mmkv', storageId: 'default' };
const otherTarget: StorageTarget = { adapterId: 'async', storageId: 'other' };

const response = (
  cursor: string | undefined,
  options: { next?: string; previous?: string } = {},
) => ({
  type: 'entry-previews' as const,
  requestId: `request-${cursor ?? 'first'}`,
  target,
  items: [
    {
      key: cursor ?? 'first',
      type: 'string' as const,
      preview: cursor ?? 'first',
      valueSize: (cursor ?? 'first').length,
      isTruncated: false,
    },
  ],
  nextCursor: options.next,
  previousCursor: options.previous,
});

type PreviewProps = Parameters<typeof useStorageEntryPreviews>[0];

const renderPreviewHook = async (initialProps: PreviewProps) => {
  const queryClient = createStorageQueryClient();
  let result: ReturnType<typeof useStorageEntryPreviews> | undefined;
  const container = document.createElement('div');
  const root = createRoot(container);

  const Hook = (props: PreviewProps) => {
    result = useStorageEntryPreviews(props);
    return null;
  };

  const render = async (props: PreviewProps) => {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Hook {...props} />
        </QueryClientProvider>,
      );
    });
  };

  await render(initialProps);
  return {
    get result() {
      if (!result) throw new Error('Hook did not render.');
      return result;
    },
    queryClient,
    rerender: render,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
};

const asClient = (request: ReturnType<typeof vi.fn>) =>
  ({ request }) as unknown as RozeniteDevToolsRequestClient<StorageEventMap>;

describe('storage entry query hooks', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('loads both directions and bounds retained pages', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const request = vi.fn(({ payload }) => {
      if (payload.cursor === undefined)
        return Promise.resolve(response(undefined, { next: 'next' }));
      if (payload.cursor === 'next')
        return Promise.resolve(response('next', { next: 'last', previous: 'first' }));
      if (payload.cursor === 'last') return Promise.resolve(response('last', { previous: 'next' }));
      return Promise.resolve(response('first', { next: 'next' }));
    });
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: '',
      keySortDirection: 'ascending',
      maxPages: 2,
    });

    await act(async () => {
      await vi.waitFor(() => expect(hook.result.isSuccess).toBe(true));
    });
    await act(async () => hook.result.fetchNextPage());
    await act(async () => hook.result.fetchNextPage());
    expect(request.mock.calls.map(([options]) => options.payload.cursor)).toEqual([
      undefined,
      'next',
      'last',
    ]);
    const queryKey = storageEntryPreviewQueryKey(target, '', 'ascending');
    const pageKeys = () =>
      hook.queryClient
        .getQueryData<{ pages: Array<ReturnType<typeof response>> }>(queryKey)
        ?.pages.map((page) => page.items[0].key);
    await vi.waitFor(() => expect(pageKeys()).toEqual(['next', 'last']));

    await act(async () => hook.result.fetchPreviousPage());
    await vi.waitFor(() => expect(pageKeys()).toEqual(['first', 'next']));
    await hook.unmount();
  });

  it('cancels stale target requests and starts a new sequence at the first page', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let resolveFirst: ((value: ReturnType<typeof response>) => void) | undefined;
    const request = vi.fn(({ payload }) => {
      if (payload.target === target) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return Promise.resolve({ ...response(undefined), target: otherTarget });
    });
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: 'one',
      keySortDirection: 'ascending',
    });
    const firstSignal = request.mock.calls[0][0].signal as AbortSignal;

    await hook.rerender({
      client: asClient(request),
      target: otherTarget,
      search: 'two',
      keySortDirection: 'descending',
    });
    expect(firstSignal.aborted).toBe(true);
    expect(request.mock.calls[1][0].payload).toMatchObject({
      cursor: undefined,
      search: 'two',
      keySortDirection: 'descending',
    });

    await act(async () => resolveFirst?.(response(undefined)));
    await vi.waitFor(() =>
      expect(
        hook.queryClient.getQueryData<{
          pages: Array<ReturnType<typeof response>>;
        }>(storageEntryPreviewQueryKey(otherTarget, 'two', 'descending'))?.pages[0].target,
      ).toEqual(otherTarget),
    );
    await hook.unmount();
  });

  it('keeps the previous pages while a search or sort change is loading', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    let resolveNext: ((value: ReturnType<typeof response>) => void) | undefined;
    const request = vi.fn(({ payload }) => {
      if (payload.search === 'next') {
        return new Promise((resolve) => {
          resolveNext = resolve;
        });
      }
      return Promise.resolve(response(undefined));
    });
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: 'current',
      keySortDirection: 'ascending',
    });

    await act(async () => {
      await vi.waitFor(() => expect(hook.result.isSuccess).toBe(true));
    });
    expect(hook.result.data?.pages[0].items[0].key).toBe('first');

    await hook.rerender({
      client: asClient(request),
      target,
      search: 'next',
      keySortDirection: 'descending',
    });

    expect(hook.result.isFetching).toBe(true);
    expect(hook.result.isPlaceholderData).toBe(true);
    expect(hook.result.data?.pages[0].items[0].key).toBe('first');
    expect(request.mock.calls[1][0].payload).toMatchObject({
      search: 'next',
      keySortDirection: 'descending',
    });

    await act(async () => {
      resolveNext?.(response('new'));
      await vi.waitFor(() => expect(hook.result.isPlaceholderData).toBe(false));
    });
    expect(hook.result.data?.pages[0].items[0].key).toBe('new');
    await hook.unmount();
  });

  it('exposes request errors without retrying bridge work', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const request = vi.fn(() => Promise.reject(new Error('device failed')));
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: '',
      keySortDirection: 'ascending',
    });

    await act(async () => {
      await vi.waitFor(() => expect(hook.result.isError).toBe(true));
    });
    expect(request).toHaveBeenCalledTimes(1);
    await hook.unmount();
  });

  it('resets every selected-storage preview variant but refetches only the active first page', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const request = vi.fn(({ payload }) => Promise.resolve(response(payload.cursor)));
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: 'active',
      keySortDirection: 'ascending',
    });
    await act(async () => {
      await vi.waitFor(() => expect(hook.result.isSuccess).toBe(true));
    });
    hook.queryClient.setQueryData(storageEntryPreviewQueryKey(target, 'inactive', 'ascending'), {
      pages: [response(undefined)],
      pageParams: [undefined],
    });

    await act(async () => resetSelectedStorageQueries(hook.queryClient, target));
    expect(request).toHaveBeenCalledTimes(2);
    expect(
      hook.queryClient.getQueryData(storageEntryPreviewQueryKey(target, 'inactive', 'ascending')),
    ).toBeUndefined();
    await hook.unmount();
  });

  it('invalidates only the changed storage preview prefix and drops its stale full value', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const request = vi.fn(({ payload }) => Promise.resolve(response(payload.cursor)));
    const hook = await renderPreviewHook({
      client: asClient(request),
      target,
      search: 'active',
      keySortDirection: 'ascending',
    });
    await act(async () => {
      await vi.waitFor(() => expect(hook.result.isSuccess).toBe(true));
    });
    const otherQueryKey = storageEntryPreviewQueryKey(otherTarget, 'other', 'ascending');
    hook.queryClient.setQueryDefaults(otherQueryKey, { gcTime: Infinity });
    hook.queryClient.setQueryData(otherQueryKey, {
      pages: [response(undefined)],
      pageParams: [undefined],
    });
    hook.queryClient.setQueryData(
      ['storage-full-entry', target.adapterId, target.storageId, 'changed'],
      { entry: { key: 'changed', type: 'string', value: 'stale full value' } },
    );

    await act(async () => {
      await invalidateStorageEntryPreviews(hook.queryClient, target);
      await dropStorageFullEntries(hook.queryClient, target, 'changed');
    });

    expect(request).toHaveBeenCalledTimes(2);
    expect(hook.queryClient.getQueryData(otherQueryKey)).toBeDefined();
    expect(
      hook.queryClient.getQueryData([
        'storage-full-entry',
        target.adapterId,
        target.storageId,
        'changed',
      ]),
    ).toBeUndefined();
    await hook.unmount();
  });

  it('removes a full value when its interaction unmounts', async () => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    const queryClient = createStorageQueryClient();
    const request = vi.fn(() =>
      Promise.resolve({
        type: 'entry' as const,
        requestId: 'entry-1',
        target,
        entry: { key: 'large', type: 'string' as const, value: 'full value' },
      }),
    );
    const container = document.createElement('div');
    const root = createRoot(container);
    const Hook = () => {
      useStorageFullEntry({ client: asClient(request), target, key: 'large' });
      return null;
    };

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Hook />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    });
    await act(async () => root.unmount());
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
