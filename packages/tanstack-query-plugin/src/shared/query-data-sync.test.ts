import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  applyRemoteQueryState,
  instrumentQuery,
  instrumentQueryClient,
} from './query-data-sync';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

describe('query data sync instrumentation', () => {
  it('emits query data updates for data-only setState edits', () => {
    const queryClient = createQueryClient();
    const handler = vi.fn();

    queryClient.setQueryData(['edited'], { value: 1 });
    const query = queryClient.getQueryCache().find({ queryKey: ['edited'] })!;

    instrumentQuery(query, handler);

    query.setState({
      ...query.state,
      data: { value: 2 },
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { value: 2 },
      }),
    );
  });

  it('emits query data updates for setQueryData user edits', () => {
    const queryClient = createQueryClient();
    const handler = vi.fn();

    instrumentQueryClient(queryClient, handler);

    queryClient.setQueryData(['edited'], { value: 1 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { value: 1 },
      }),
    );
  });

  it('does not emit query data updates for non-data state changes', () => {
    const queryClient = createQueryClient();
    const handler = vi.fn();

    queryClient.setQueryData(['edited'], { value: 1 });
    const query = queryClient.getQueryCache().find({ queryKey: ['edited'] })!;

    instrumentQuery(query, handler);

    query.setState({
      data: undefined,
      status: 'pending',
      fetchStatus: 'fetching',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('does not emit query data updates for remote state application', () => {
    const queryClient = createQueryClient();
    const handler = vi.fn();

    queryClient.setQueryData(['edited'], { value: 1 });
    const query = queryClient.getQueryCache().find({ queryKey: ['edited'] })!;

    instrumentQuery(query, handler);

    applyRemoteQueryState(query, {
      ...query.state,
      data: { value: 2 },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(query.state.data).toEqual({ value: 2 });
  });
});
