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

    expect(() =>
      createMMKVStorageAdapter({ storages: [storage as any] }),
    ).toThrow(/MMKV arrays are not supported for v4 storages/);
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
    const userView = views.find(
      (view) => view.target.storageId === 'user-storage',
    );
    const cacheView = views.find(
      (view) => view.target.storageId === 'cache-storage',
    );

    expect(userView).toBeDefined();
    expect(cacheView).toBeDefined();

    await expect(userView?.getAllKeys()).resolves.toEqual(['visible']);
    await expect(cacheView?.getAllKeys()).resolves.toEqual(['persisted']);
  });
});

// MMKV in production stores raw bytes per key without a type tag, so
// getString and getBuffer both return data for any stored value. This
// fake reflects that ambiguity so we can exercise the type-override
// fallback in mmkv.ts.
const createAmbiguousFakeMMKVV4 = () => {
  type Stored =
    | { kind: 'string'; value: string }
    | { kind: 'number'; value: number }
    | { kind: 'boolean'; value: boolean }
    | { kind: 'buffer'; bytes: Uint8Array };

  const values = new Map<string, Stored>();

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const encoder = new TextEncoder();

  return {
    set: vi.fn(
      (key: string, value: string | number | boolean | ArrayBuffer) => {
        if (typeof value === 'string') {
          values.set(key, { kind: 'string', value });
        } else if (typeof value === 'number') {
          values.set(key, { kind: 'number', value });
        } else if (typeof value === 'boolean') {
          values.set(key, { kind: 'boolean', value });
        } else {
          values.set(key, {
            kind: 'buffer',
            bytes: new Uint8Array(value),
          });
        }
      },
    ),
    getString: vi.fn((key: string) => {
      const stored = values.get(key);
      if (!stored) return undefined;
      if (stored.kind === 'string') return stored.value;
      if (stored.kind === 'buffer') return decoder.decode(stored.bytes);
      return undefined;
    }),
    getNumber: vi.fn((key: string) => {
      const stored = values.get(key);
      return stored?.kind === 'number' ? stored.value : undefined;
    }),
    getBoolean: vi.fn((key: string) => {
      const stored = values.get(key);
      return stored?.kind === 'boolean' ? stored.value : undefined;
    }),
    getBuffer: vi.fn((key: string) => {
      const stored = values.get(key);
      if (!stored) return undefined;
      if (stored.kind === 'buffer') return stored.bytes.buffer;
      if (stored.kind === 'string') return encoder.encode(stored.value).buffer;
      return undefined;
    }),
    remove: vi.fn((key: string) => {
      values.delete(key);
    }),
    getAllKeys: vi.fn(() => [...values.keys()]),
    addOnValueChangedListener: vi.fn(() => ({ remove: vi.fn() })),
  };
};

describe('createMMKVStorageAdapter type override (round-trip)', () => {
  it('returns a buffer after setting a buffer whose bytes are valid ASCII', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // 0x68 0x65 0x6c 0x6c 0x6f = "hello" in ASCII — the regression case.
    await view.set({
      key: 'token',
      type: 'buffer',
      value: [0x68, 0x65, 0x6c, 0x6c, 0x6f],
    });

    await expect(view.get('token')).resolves.toEqual({
      key: 'token',
      type: 'buffer',
      value: [0x68, 0x65, 0x6c, 0x6c, 0x6f],
    });
  });

  it('returns a string after setting a string at a key previously set as a buffer', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({
      key: 'flip',
      type: 'buffer',
      value: [0x68, 0x65, 0x6c, 0x6c, 0x6f],
    });
    await view.set({
      key: 'flip',
      type: 'string',
      value: 'world',
    });

    await expect(view.get('flip')).resolves.toEqual({
      key: 'flip',
      type: 'string',
      value: 'world',
    });
  });

  it('drops the type override when the key is deleted', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    await view.set({
      key: 'temp',
      type: 'buffer',
      value: [0x68, 0x69],
    });
    await view.delete('temp');

    await expect(view.get('temp')).resolves.toBeUndefined();
    // After deletion, the override is dropped — a subsequent ambiguous
    // write from outside the plugin would fall back to the heuristic.
    storage.set('temp', 'hello');
    await expect(view.get('temp')).resolves.toEqual({
      key: 'temp',
      type: 'string',
      value: 'hello',
    });
  });

  it('falls through to the heuristic when no override exists (cold-start limitation)', async () => {
    const storage = createAmbiguousFakeMMKVV4();
    // Simulate an app-side buffer write the plugin never observed.
    storage.set(
      'preexisting',
      new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f]).buffer,
    );

    const adapter = createMMKVStorageAdapter({
      storages: { 'user-storage': storage as any },
    });
    const [view] = createStorageViews([adapter]);

    // Documented limitation: without an override, a buffer that decodes to
    // valid printable ASCII is classified as a string by the heuristic.
    await expect(view.get('preexisting')).resolves.toEqual({
      key: 'preexisting',
      type: 'string',
      value: 'hello',
    });
  });
});
