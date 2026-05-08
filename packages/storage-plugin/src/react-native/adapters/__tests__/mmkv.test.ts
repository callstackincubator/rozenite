import { describe, expect, it, vi } from 'vitest';
import { createMMKVStorageAdapter } from '../mmkv';
import { createStorageViews } from '../../storage-view';

type StoredValue = string | number | boolean | ArrayBuffer;

const createFakeMMKVV3 = (id: string) => {
  const values = new Map<string, StoredValue>();

  return {
    id,
    set: vi.fn((key: string, value: StoredValue) => {
      values.set(key, value);
    }),
    getBoolean: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'boolean' ? value : undefined;
    }),
    getString: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'string' ? value : undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'number' ? value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const value = values.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    }),
    delete: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

const createFakeMMKVV4 = () => {
  const values = new Map<string, StoredValue>();

  return {
    set: vi.fn((key: string, value: StoredValue) => {
      values.set(key, value);
    }),
    getBoolean: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'boolean' ? value : undefined;
    }),
    getString: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'string' ? value : undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const value = values.get(key);
      return typeof value === 'number' ? value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const value = values.get(key);
      return value instanceof ArrayBuffer ? value : undefined;
    }),
    remove: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

describe('createMMKVStorageAdapter', () => {
  it('supports MMKV v3 storages passed as an array', async () => {
    const storage = createFakeMMKVV3('user-storage');
    const adapter = createMMKVStorageAdapter({ storages: [storage as any] });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'theme', type: 'string', value: 'dark' });

    expect(view.target).toEqual({
      adapterId: 'mmkv',
      storageId: 'user-storage',
    });
    await expect(view.get('theme')).resolves.toEqual({
      key: 'theme',
      type: 'string',
      value: 'dark',
    });
  });

  it('supports MMKV v4 storages passed as a record', async () => {
    const storage = createFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({ key: 'logged-in', type: 'boolean', value: true });
    await expect(view.get('logged-in')).resolves.toEqual({
      key: 'logged-in',
      type: 'boolean',
      value: true,
    });

    await view.delete('logged-in');

    expect(storage.remove).toHaveBeenCalledWith('logged-in');
    await expect(view.get('logged-in')).resolves.toBeUndefined();
  });

  it('rejects MMKV v4 storages passed as an array', () => {
    const storage = createFakeMMKVV4();

    expect(() => createMMKVStorageAdapter({ storages: [storage as any] })).toThrow(
      /MMKV arrays are not supported for v4 storages/
    );
  });

  it('applies global blacklist patterns against storageId:key', async () => {
    const userStorage = createFakeMMKVV3('user-storage');
    const cacheStorage = createFakeMMKVV3('cache-storage');

    userStorage.set('visible', 'ok');
    userStorage.set('secret', 'hide');
    cacheStorage.set('temp-file', 'hide');
    cacheStorage.set('persisted', 'ok');

    const adapter = createMMKVStorageAdapter({
      storages: [userStorage as any, cacheStorage as any],
      blacklist: /user-storage:secret|cache-storage:temp.*/,
    });

    const views = createStorageViews([adapter]);
    const userView = views.find((view) => view.target.storageId === 'user-storage');
    const cacheView = views.find((view) => view.target.storageId === 'cache-storage');

    expect(userView).toBeDefined();
    expect(cacheView).toBeDefined();

    await expect(userView?.getAllKeys()).resolves.toEqual(['visible']);
    await expect(cacheView?.getAllKeys()).resolves.toEqual(['persisted']);
  });
});
