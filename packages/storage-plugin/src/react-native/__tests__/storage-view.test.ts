import { describe, expect, it, vi } from 'vitest';
import { createMMKVStorageAdapter } from '../adapters/mmkv';
import { createStorageViews } from '../storage-view';
import type { StorageAdapter, StorageEntry } from '../../shared/types';

describe('StorageView subscriptions', () => {
  it('uses the storage clear operation when purging', async () => {
    const clear = vi.fn();
    const adapter: StorageAdapter = {
      id: 'manual',
      name: 'Manual',
      storages: [
        {
          id: 'storage',
          name: 'Storage',
          capabilities: { supportedTypes: ['string'] },
          storage: {
            kind: 'sync',
            getAllKeys: vi.fn(() => ['key']),
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            clear,
          },
        },
      ],
    };

    const [view] = createStorageViews([adapter]);
    await view.purge();

    expect(clear).toHaveBeenCalledOnce();
  });

  it('delegates purging to the storage implementation', async () => {
    const clear = vi.fn();
    const adapter: StorageAdapter = {
      id: 'manual',
      name: 'Manual',
      storages: [
        {
          id: 'storage',
          name: 'Storage',
          capabilities: { supportedTypes: ['string'] },
          storage: {
            kind: 'sync',
            getAllKeys: vi.fn(() => ['first', 'second']),
            get: vi.fn(),
            set: vi.fn(),
            delete: vi.fn(),
            clear,
          },
        },
      ],
    };

    const [view] = createStorageViews([adapter]);
    await view.purge();

    expect(clear).toHaveBeenCalledOnce();
  });

  it('does not create a watcher or read unsupported storage while idle', async () => {
    const getAllKeys = vi.fn(() => ['key']);
    const get = vi.fn((): StorageEntry | undefined => ({
      key: 'key',
      type: 'string',
      value: 'value',
    }));
    const adapter: StorageAdapter = {
      id: 'manual',
      name: 'Manual',
      storages: [
        {
          id: 'storage',
          name: 'Storage',
          capabilities: { supportedTypes: ['string'] },
          storage: {
            kind: 'sync',
            getAllKeys,
            get,
            set: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
          },
        },
      ],
    };

    const [view] = createStorageViews([adapter]);

    expect(view.supportsSubscriptions).toBe(false);
    expect(view.watch).toBeUndefined();
    expect(getAllKeys).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it('forwards native MMKV changes as key-only invalidations without reading values', async () => {
    let onValueChanged: ((key: string) => void) | undefined;
    const remove = vi.fn();
    const storage = {
      getBoolean: vi.fn(() => undefined),
      getString: vi.fn((key: string) => (key === 'theme' ? 'dark' : undefined)),
      getNumber: vi.fn(() => undefined),
      getBuffer: vi.fn(() => undefined),
      set: vi.fn(),
      remove: vi.fn(),
      getAllKeys: vi.fn(() => ['theme']),
      addOnValueChangedListener: vi.fn((listener: (key: string) => void) => {
        onValueChanged = listener;
        return { remove };
      }),
    };
    const [view] = createStorageViews([
      createMMKVStorageAdapter({ storages: { settings: storage as never } }),
    ]);
    const onChange = vi.fn();

    expect(view.supportsSubscriptions).toBe(true);
    expect(view.watch).toBeDefined();
    const subscription = await view.watch?.(onChange);
    expect(storage.addOnValueChangedListener).toHaveBeenCalledTimes(1);

    onValueChanged?.('theme');
    expect(onChange).toHaveBeenCalledWith('theme');

    onValueChanged?.('removed');
    expect(onChange).toHaveBeenCalledWith('removed');
    expect(storage.getString).not.toHaveBeenCalled();
    expect(storage.getNumber).not.toHaveBeenCalled();
    expect(storage.getBoolean).not.toHaveBeenCalled();
    expect(storage.getBuffer).not.toHaveBeenCalled();
    expect(storage.getAllKeys).not.toHaveBeenCalled();

    subscription?.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('does not duplicate synchronous callbacks caused by plugin-originated writes', async () => {
    let onValueChanged: ((key: string) => void) | undefined;
    const adapter: StorageAdapter = {
      id: 'subscribed',
      name: 'Subscribed',
      storages: [
        {
          id: 'storage',
          name: 'Storage',
          capabilities: { supportedTypes: ['string'] },
          storage: {
            kind: 'sync',
            getAllKeys: vi.fn(() => []),
            get: vi.fn(),
            set: vi.fn((entry: StorageEntry) => onValueChanged?.(entry.key)),
            delete: vi.fn(),
            clear: vi.fn(),
            subscribe: vi.fn((listener) => {
              onValueChanged = listener;
              return { remove: vi.fn() };
            }),
          },
        },
      ],
    };
    const [view] = createStorageViews([adapter]);
    const onChange = vi.fn();
    await view.watch?.(onChange);

    await view.set({ key: 'written', type: 'string', value: 'value' });

    expect(onChange).not.toHaveBeenCalled();
  });
});
