import { describe, expect, it, vi } from 'vitest';
import { createKeychainStorageAdapter } from '../adapters/keychain';
import type { KeychainLike } from '../adapters/keychain';

const createFakeKeychain = (
  initial: Record<string, { username: string; password: string }> = {},
) => {
  const items = new Map(Object.entries(initial));

  const keychain = {
    getAllGenericPasswordServices: vi.fn(async () => [...items.keys()]),
    getGenericPassword: vi.fn(
      async ({ service }: { service: string }) => items.get(service) ?? false,
    ),
    setGenericPassword: vi.fn(
      async (username: string, password: string, options?: { service?: string }) => {
        items.set(options?.service ?? 'default', { username, password });
      },
    ),
    resetGenericPassword: vi.fn(async ({ service }: { service: string }) => {
      items.delete(service);
    }),
  } satisfies KeychainLike;

  return { keychain, items };
};

const getStorage = (adapter: ReturnType<typeof createKeychainStorageAdapter>) => {
  const [node] = adapter.storages;
  if (node.storage.kind !== 'async') {
    throw new Error('Expected an async storage.');
  }

  return node.storage;
};

describe('createKeychainStorageAdapter', () => {
  it('exposes one string-only storage with sensible defaults', () => {
    const { keychain } = createFakeKeychain();
    const adapter = createKeychainStorageAdapter({ keychain });

    expect(adapter.id).toBe('react-native-keychain');
    expect(adapter.name).toBe('React Native Keychain');
    expect(adapter.storages).toHaveLength(1);
    expect(adapter.storages[0].capabilities.supportedTypes).toEqual(['string']);
  });

  it('exposes no storages when react-native-keychain is missing', () => {
    expect(createKeychainStorageAdapter({ keychain: undefined }).storages).toEqual([]);
    expect(createKeychainStorageAdapter({ keychain: null }).storages).toEqual([]);
  });

  it('lists every keychain service by default', async () => {
    const { keychain } = createFakeKeychain({
      token: { username: 'a', password: '1' },
      session: { username: 'b', password: '2' },
    });
    const storage = getStorage(createKeychainStorageAdapter({ keychain }));

    expect(await storage.getAllKeys()).toEqual(['token', 'session']);
  });

  it('uses the services option, either as a list or as a function', async () => {
    const { keychain } = createFakeKeychain();

    const fromList = getStorage(createKeychainStorageAdapter({ keychain, services: ['a'] }));
    const fromFunction = getStorage(
      createKeychainStorageAdapter({ keychain, services: async () => ['b'] }),
    );

    expect(await fromList.getAllKeys()).toEqual(['a']);
    expect(await fromFunction.getAllKeys()).toEqual(['b']);
    expect(keychain.getAllGenericPasswordServices).not.toHaveBeenCalled();
  });

  it('reads the password as the entry value and returns undefined for missing services', async () => {
    const { keychain } = createFakeKeychain({
      token: { username: 'alice', password: 'secret' },
    });
    const storage = getStorage(createKeychainStorageAdapter({ keychain }));

    expect(await storage.get('token')).toEqual({
      key: 'token',
      type: 'string',
      value: 'secret',
    });
    expect(await storage.get('missing')).toBeUndefined();
  });

  it('keeps the existing username when updating an entry', async () => {
    const { keychain, items } = createFakeKeychain({
      token: { username: 'alice', password: 'old' },
    });
    const storage = getStorage(
      createKeychainStorageAdapter({
        keychain,
        setOptions: { accessible: 'AccessibleWhenUnlocked' },
      }),
    );

    await storage.set({ key: 'token', type: 'string', value: 'new' });

    expect(items.get('token')).toEqual({ username: 'alice', password: 'new' });
    expect(keychain.setGenericPassword).toHaveBeenCalledWith('alice', 'new', {
      accessible: 'AccessibleWhenUnlocked',
      service: 'token',
    });
  });

  it('uses the default username for new entries', async () => {
    const { keychain, items } = createFakeKeychain();
    const storage = getStorage(
      createKeychainStorageAdapter({ keychain, defaultUsername: 'rozenite' }),
    );

    await storage.set({ key: 'fresh', type: 'string', value: 'value' });

    expect(items.get('fresh')).toEqual({
      username: 'rozenite',
      password: 'value',
    });
  });

  it('rejects non-string values', async () => {
    const { keychain } = createFakeKeychain();
    const storage = getStorage(createKeychainStorageAdapter({ keychain }));

    await expect(storage.set({ key: 'n', type: 'number', value: 1 })).rejects.toThrow(
      'supports only string values',
    );
  });

  it('deletes a single service and clears all of them', async () => {
    const { keychain, items } = createFakeKeychain({
      a: { username: 'u', password: '1' },
      b: { username: 'u', password: '2' },
      c: { username: 'u', password: '3' },
    });
    const storage = getStorage(createKeychainStorageAdapter({ keychain }));

    await storage.delete('a');
    expect([...items.keys()]).toEqual(['b', 'c']);

    await storage.clear();
    expect(items.size).toBe(0);
  });

  it('rejects every mutation when read-only', async () => {
    const { keychain, items } = createFakeKeychain({
      a: { username: 'u', password: '1' },
    });
    const storage = getStorage(createKeychainStorageAdapter({ keychain, readOnly: true }));

    await expect(storage.set({ key: 'a', type: 'string', value: 'x' })).rejects.toThrow(
      'read-only',
    );
    await expect(storage.delete('a')).rejects.toThrow('read-only');
    await expect(storage.clear()).rejects.toThrow('read-only');
    expect(items.get('a')).toEqual({ username: 'u', password: '1' });
  });
});
