// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TanStackQueryPluginClient } from '../shared/messaging';
import { useSyncInitialData } from './useSyncInitialData';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Listener = (payload: unknown) => void;

const createClient = () => {
  const listeners = new Map<string, Set<Listener>>();

  return {
    send: vi.fn(),
    onMessage: vi.fn((type: string, listener: Listener) => {
      const typeListeners = listeners.get(type) ?? new Set<Listener>();
      typeListeners.add(listener);
      listeners.set(type, typeListeners);
      return { remove: () => typeListeners.delete(listener) };
    }),
    close: vi.fn(),
    emit: (type: string, payload: unknown) =>
      listeners.get(type)?.forEach((listener) => listener(payload)),
  };
};

const requests = (client: ReturnType<typeof createClient>) =>
  client.send.mock.calls.filter(([type]) => type === 'request-initial-data');

describe('useSyncInitialData', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    document.body.innerHTML = '';
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  // The panel is recreated on every app reload and asks for the cache before the
  // app's React tree has mounted the plugin, so its first request is dropped.
  it('asks for the cache again when the device announces itself', async () => {
    const client = createClient();
    const queryClient = new QueryClient();
    queryClient.setQueryData(['stale-from-previous-context'], 'value');

    const Harness = ({ children }: { children?: ReactNode }) => {
      useSyncInitialData(client as unknown as TanStackQueryPluginClient);
      return <>{children}</>;
    };
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness />
        </QueryClientProvider>,
      ),
    );

    expect(requests(client)).toHaveLength(1);

    await act(async () => client.emit('device-ready', {}));

    expect(requests(client)).toHaveLength(2);
    expect(queryClient.getQueryData(['stale-from-previous-context'])).toBeUndefined();

    await act(async () => root.unmount());
  });
});
