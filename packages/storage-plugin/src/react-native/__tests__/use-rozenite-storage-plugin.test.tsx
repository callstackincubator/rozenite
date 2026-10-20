// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '../../shared/types';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

type Listener = (payload: unknown) => void;

const mocks = vi.hoisted(() => {
  const listeners = new Map<string, Listener>();
  return {
    listeners,
    client: {
      send: vi.fn(),
      onMessage: vi.fn((type: string, listener: Listener) => {
        listeners.set(type, listener);
        return { remove: () => listeners.delete(type) };
      }),
    },
  };
});

vi.mock('@rozenite/plugin-bridge', () => ({
  useRozeniteDevToolsClient: () => mocks.client,
}));
vi.mock('@rozenite/agent-bridge', () => ({
  useRozenitePluginAgentTool: vi.fn(),
}));

import { useRozeniteStoragePlugin } from '../useRozeniteStoragePlugin';

const target = { adapterId: 'adapter', storageId: 'storage' };

const render = async (storages: StorageAdapter[]) => {
  const Harness = () => {
    useRozeniteStoragePlugin({ storages });
    return null;
  };
  const root = createRoot(document.createElement('div'));
  await act(async () => root.render(<Harness />));
  return root;
};

describe('useRozeniteStoragePlugin purge-storage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    mocks.listeners.clear();
    mocks.client.send.mockReset();
  });
  afterEach(() => {
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
  });

  it('refreshes the panel even when the purge fails partway', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const keys = ['a', 'b', 'c'];
    const root = await render([
      {
        id: target.adapterId,
        name: 'Adapter',
        storages: [
          {
            id: target.storageId,
            name: 'Storage',
            capabilities: { supportedTypes: ['string'] },
            storage: {
              kind: 'async',
              getAllKeys: async () => keys,
              get: async () => undefined,
              set: async () => {},
              delete: async () => {},
              clear: async () => {
                keys.splice(0, keys.length, 'b');
                throw new Error('Could not clear services: b.');
              },
            },
          },
        ],
      },
    ]);

    await act(async () =>
      mocks.listeners.get('purge-storage')?.({ type: 'purge-storage', target }),
    );

    expect(mocks.client.send).toHaveBeenCalledWith('storage-invalidated', {
      type: 'storage-invalidated',
      target,
      key: undefined,
      operation: 'purge',
      entryCount: 1,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Failed to purge storage in adapter/storage'),
      expect.any(Error),
    );
    warn.mockRestore();
    await act(async () => root.unmount());
  });
});
