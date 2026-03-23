import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Mutation,
  QueryClient,
  QueryObserver,
  onlineManager,
} from '@tanstack/react-query';
import {
  applyTanStackQueryDevtoolsAction,
} from '../../devtools-actions';
import {
  createTanStackQueryAgentController,
  serializeForAgent,
  TANSTACK_QUERY_AGENT_TOOLS,
} from '../tanstack-query-agent';

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });

const subscribeController = (
  queryClient: QueryClient,
  controller: ReturnType<typeof createTanStackQueryAgentController>
) => {
  const unsubscribeQuery = queryClient
    .getQueryCache()
    .subscribe((event) => controller.handleQueryCacheEvent(event));
  const unsubscribeMutation = queryClient
    .getMutationCache()
    .subscribe((event) => controller.handleMutationCacheEvent(event));

  return () => {
    unsubscribeQuery();
    unsubscribeMutation();
  };
};

const createMutation = (
  queryClient: QueryClient,
  options?: {
    mutationKey?: unknown[];
    status?: 'idle' | 'pending' | 'success' | 'error';
    submittedAt?: number;
    isPaused?: boolean;
    variables?: unknown;
    data?: unknown;
    error?: Error | null;
    context?: unknown;
    failureCount?: number;
    failureReason?: Error | null;
  }
) => {
  return queryClient.getMutationCache().build(
    queryClient,
    {
      mutationKey: options?.mutationKey ?? ['mutation'],
      mutationFn: async () => ({ ok: true }),
      onSuccess: () => undefined,
      meta: { source: 'test' },
    },
    {
      context: options?.context,
      data: options?.data,
      error: options?.error ?? null,
      failureCount: options?.failureCount ?? 0,
      failureReason: options?.failureReason ?? null,
      isPaused: options?.isPaused ?? false,
      status: options?.status ?? 'success',
      submittedAt: options?.submittedAt ?? Date.now(),
      variables: options?.variables,
    } as any
  ) as Mutation<unknown, Error, unknown, unknown>;
};

afterEach(() => {
  vi.restoreAllMocks();
  onlineManager.setOnline(true);
});

describe('tanstack query agent controller', () => {
  it('exposes the expected tool names', () => {
    expect(TANSTACK_QUERY_AGENT_TOOLS.map((tool) => tool.name)).toEqual([
      'get-cache-summary',
      'get-online-status',
      'set-online-status',
      'list-queries',
      'get-query-details',
      'refetch-query',
      'set-query-loading',
      'set-query-error',
      'invalidate-query',
      'reset-query',
      'remove-query',
      'clear-query-cache',
      'list-mutations',
      'get-mutation-details',
      'clear-mutation-cache',
    ]);
  });

  it('lists queries with cursor pagination and invalidates stale cursors after additions', async () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);
    const unsubscribe = subscribeController(queryClient, controller);

    queryClient.setQueryData(['first'], { value: 1 });
    queryClient.setQueryData(['second'], { value: 2 });

    const firstPage = controller.listQueries({ limit: 1 });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.page.hasMore).toBe(true);

    queryClient.setQueryData(['third'], { value: 3 });

    expect(() =>
      controller.listQueries({
        limit: 1,
        cursor: firstPage.page.nextCursor,
      })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');

    unsubscribe();
  });

  it('invalidates query cursors after removals and cache clears', () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);
    const unsubscribe = subscribeController(queryClient, controller);

    queryClient.setQueryData(['first'], { value: 1 });
    queryClient.setQueryData(['second'], { value: 2 });

    const firstPage = controller.listQueries({ limit: 1 });
    queryClient.removeQueries({ queryKey: ['second'] });

    expect(() =>
      controller.listQueries({
        limit: 1,
        cursor: firstPage.page.nextCursor,
      })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');

    queryClient.setQueryData(['third'], { value: 3 });
    queryClient.setQueryData(['fourth'], { value: 4 });
    const secondPageSeed = controller.listQueries({ limit: 1 });
    queryClient.getQueryCache().clear();

    expect(() =>
      controller.listQueries({
        limit: 1,
        cursor: secondPageSeed.page.nextCursor,
      })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');

    unsubscribe();
  });

  it('lists mutations with cursor pagination and invalidates stale cursors after structural changes', () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);
    const unsubscribe = subscribeController(queryClient, controller);

    createMutation(queryClient, {
      mutationKey: ['first'],
      submittedAt: 100,
      data: { ok: true },
    });
    createMutation(queryClient, {
      mutationKey: ['second'],
      submittedAt: 200,
      data: { ok: true },
    });

    const firstPage = controller.listMutations({ limit: 1 });
    expect(firstPage.items).toHaveLength(1);

    createMutation(queryClient, {
      mutationKey: ['third'],
      submittedAt: 300,
      data: { ok: true },
    });

    expect(() =>
      controller.listMutations({
        limit: 1,
        cursor: firstPage.page.nextCursor,
      })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');

    const mutation = queryClient.getMutationCache().getAll()[0];
    queryClient.getMutationCache().remove(mutation);

    const secondPageSeed = controller.listMutations({ limit: 1 });
    queryClient.getMutationCache().clear();

    expect(() =>
      controller.listMutations({
        limit: 1,
        cursor: secondPageSeed.page.nextCursor,
      })
    ).toThrow('Cursor does not match the requested listing. Run the command again.');

    unsubscribe();
  });

  it('returns JSON-safe query details with curated observer summaries', async () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);
    const unsubscribe = subscribeController(queryClient, controller);
    const queryFn = vi.fn(async () => ({
      ok: true,
      nested: { fn: () => 'ignored' },
    }));

    const observer = new QueryObserver(queryClient, {
      queryKey: ['todos', 1],
      queryFn,
      select: (data) => data,
      meta: { source: 'observer' },
    });
    const observerUnsubscribe = observer.subscribe(() => undefined);
    await queryClient.fetchQuery({
      queryKey: ['todos', 1],
      queryFn,
    });

    const queryHash = queryClient.getQueryCache().find({ queryKey: ['todos', 1] })!
      .queryHash;
    const details = controller.getQueryDetails({ queryHash });

    expect(details.query).toMatchObject({
      queryHash,
      queryKey: ['todos', 1],
      observersCount: 1,
      data: {
        ok: true,
        nested: {
          fn: '[non-serializable:function]',
        },
      },
    });
    expect(details.query.observers[0]?.options).toMatchObject({
      hasQueryFn: true,
      hasSelect: true,
      meta: { source: 'observer' },
    });

    observerUnsubscribe();
    unsubscribe();
  });

  it('returns JSON-safe mutation details and validates unknown ids', () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);
    const unsubscribe = subscribeController(queryClient, controller);

    const mutation = createMutation(queryClient, {
      mutationKey: ['save'],
      status: 'error',
      submittedAt: 123,
      variables: { id: 1, fn: () => undefined },
      context: { optimistic: true },
      error: new Error('boom'),
      failureCount: 2,
      failureReason: new Error('network'),
    });

    const details = controller.getMutationDetails({
      mutationId: mutation.mutationId,
    });

    expect(details.mutation).toMatchObject({
      mutationId: mutation.mutationId,
      mutationKey: ['save'],
      status: 'error',
      variables: {
        id: 1,
        fn: '[non-serializable:function]',
      },
      error: {
        message: 'boom',
      },
      failureReason: {
        message: 'network',
      },
      options: {
        hasMutationFn: true,
        hasOnSuccess: true,
      },
    });

    expect(() =>
      controller.getMutationDetails({ mutationId: 9999 })
    ).toThrow('Unknown mutationId "9999"');

    unsubscribe();
  });

  it('validates unknown query hashes', () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);

    expect(() =>
      controller.getQueryDetails({ queryHash: 'missing' })
    ).toThrow('Unknown queryHash "missing"');
  });

  it('gets and sets the online manager status', () => {
    const queryClient = createQueryClient();
    const controller = createTanStackQueryAgentController(queryClient);

    expect(controller.getOnlineStatus()).toEqual({ online: true });
    expect(controller.setOnlineStatus({ online: false })).toEqual({
      online: false,
    });
    expect(controller.getOnlineStatus()).toEqual({ online: false });
  });
});

describe('tanstack query agent actions', () => {
  it('refetches a query', async () => {
    const queryClient = createQueryClient();
    const queryFn = vi.fn(async () => ({ ok: true }));

    await queryClient.fetchQuery({
      queryKey: ['refetch-me'],
      queryFn,
    });

    const queryHash = queryClient.getQueryCache().find({
      queryKey: ['refetch-me'],
    })!.queryHash;

    const result = await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'REFETCH',
      queryHash,
    });

    expect(result).toMatchObject({
      applied: true,
      action: 'REFETCH',
      queryHash,
    });
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it('sets and restores query loading and error states through boolean tools', async () => {
    const queryClient = createQueryClient();
    const queryFn = vi.fn(async () => ({ ok: true }));
    const controller = createTanStackQueryAgentController(queryClient);

    await queryClient.fetchQuery({
      queryKey: ['simulate-me'],
      queryFn,
    });

    const query = queryClient.getQueryCache().find({
      queryKey: ['simulate-me'],
    })!;
    const queryHash = query.queryHash;

    const loadingResult = await controller.setQueryLoading({
      queryHash,
      enabled: true,
    });
    expect(loadingResult).toMatchObject({
      applied: true,
      action: 'TRIGGER_LOADING',
      queryHash,
    });
    expect(query.state.status).toBe('pending');

    const restoreLoadingResult = await controller.setQueryLoading({
      queryHash,
      enabled: false,
    });
    expect(restoreLoadingResult).toMatchObject({
      applied: true,
      action: 'RESTORE_LOADING',
      queryHash,
    });

    const errorResult = await controller.setQueryError({
      queryHash,
      enabled: true,
    });
    expect(errorResult).toMatchObject({
      applied: true,
      action: 'TRIGGER_ERROR',
      queryHash,
    });
    expect(query.state.status).toBe('error');

    const restoreErrorResult = await controller.setQueryError({
      queryHash,
      enabled: false,
    });
    expect(restoreErrorResult).toMatchObject({
      applied: true,
      action: 'RESTORE_ERROR',
      queryHash,
    });
  });

  it('invalidates, resets, removes, and clears query cache entries', async () => {
    const queryClient = createQueryClient();
    const queryFn = vi.fn(async () => 'fresh');

    await queryClient.fetchQuery({
      queryKey: ['query-actions'],
      queryFn,
      initialData: 'seed',
    });

    const query = queryClient.getQueryCache().find({
      queryKey: ['query-actions'],
    })!;
    const queryHash = query.queryHash;

    await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'INVALIDATE',
      queryHash,
    });
    expect(query.state.isInvalidated).toBe(true);

    queryClient.setQueryData(['query-actions'], 'changed');
    await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'RESET',
      queryHash,
    });
    expect(queryClient.getQueryCache().get(queryHash)).toBeTruthy();

    await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'REMOVE',
      queryHash,
    });
    expect(queryClient.getQueryCache().get(queryHash)).toBeUndefined();

    queryClient.setQueryData(['clear-one'], 1);
    queryClient.setQueryData(['clear-two'], 2);

    const result = await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'CLEAR_QUERY_CACHE',
    });
    expect(result).toEqual({
      applied: true,
      action: 'CLEAR_QUERY_CACHE',
      cleared: true,
      queryCountBefore: 2,
      queryCountAfter: 0,
    });
  });

  it('clears mutation cache through the shared UI/agent dispatcher', async () => {
    const queryClient = createQueryClient();
    createMutation(queryClient, {
      mutationKey: ['one'],
      submittedAt: 1,
      data: { ok: true },
    });
    createMutation(queryClient, {
      mutationKey: ['two'],
      submittedAt: 2,
      data: { ok: true },
    });

    const result = await applyTanStackQueryDevtoolsAction(queryClient, {
      type: 'CLEAR_MUTATION_CACHE',
    });

    expect(result).toEqual({
      applied: true,
      action: 'CLEAR_MUTATION_CACHE',
      cleared: true,
      mutationCountBefore: 2,
      mutationCountAfter: 0,
    });
  });
});

describe('serializeForAgent', () => {
  it('handles circular values and class instances safely', () => {
    class Example {
      value = 1;
    }

    const circular: Record<string, unknown> = { ok: true };
    circular.self = circular;

    expect(serializeForAgent(circular)).toEqual({
      ok: true,
      self: '[circular]',
    });
    expect(serializeForAgent(new Example())).toBe(
      '[non-serializable:Example]'
    );
  });
});
