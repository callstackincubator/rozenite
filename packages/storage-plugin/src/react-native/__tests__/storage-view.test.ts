import { describe, expect, it, vi } from 'vitest';
import { createMMKVStorageAdapter } from '../adapters/mmkv';
import { createStorageViews } from '../storage-view';
import type { StorageAdapter, StorageEntry } from '../../shared/types';

describe('StorageView subscriptions', () => {
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

  it('forwards native MMKV changes through the existing set and delete callbacks', async () => {
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
    const onSet = vi.fn();
    const onDelete = vi.fn();

    expect(view.supportsSubscriptions).toBe(true);
    expect(view.watch).toBeDefined();
    const subscription = await view.watch?.({ onSet, onDelete });
    expect(storage.addOnValueChangedListener).toHaveBeenCalledTimes(1);

    onValueChanged?.('theme');
    await vi.waitFor(() => {
      expect(onSet).toHaveBeenCalledWith({
        key: 'theme',
        type: 'string',
        value: 'dark',
      });
    });

    onValueChanged?.('removed');
    await vi.waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('removed');
    });

    subscription?.remove();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
